const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const Token = require('../models/tokenModel');
const Email = require('../utils/email');
const AppError = require('../utils/appError');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    sameSite: 'none',
  });

  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: user,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (user) {
    return next(new AppError('Email already Exist', 409));
  }

  let token = await Token.findOne({ email: req.body.email });
  const data = {
    name: req.body.name,
    email: req.body.email,
  };

  if (token) {
    token.name = req.body.name;
    token.email = req.body.email;
    token = await token.save();
  } else {
    token = await Token.create(data);
  }

  const verifyToken = token.createEmailVerificationToken();

  token = await token.save();

  // const url = `${req.protocol}://${req.get(
  //   'host'
  // )}/api/v1/users/verify/${verifyToken}`;

  // const url = `${req.protocol}://${req.get(
  //   'host'
  // )}/#/setPassword/${verifyToken}`;

  // const url = `${req.protocol}://localhost:3000/setPassword/${verifyToken}`;

  let url;

  if (process.env.NODE_ENV.trim() === 'production') {
    url = `https://gopendrajangir.github.io/howdoising/#/setPassword/${verifyToken}`;
  } else {
    url = `http://localhost:3000/howdoising/#/setPassword/${verifyToken}`;
  }

  await new Email(token, url).sendEmailVerification();

  res.status(200).json({
    status: 'success',
    message: 'Email verification link sent to mail',
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or password', 401));
  }
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
};

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const token = await Token.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!token) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  const data = {
    name: token.name,
    email: token.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  };

  const newUser = await User.create(data);

  await token.remove();

  createSendToken(newUser, 200, req, res);
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
  });
  if (!user) {
    return next(new AppError('There is no user with this email address', 404));
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    // const url = `${req.protocol}://${req.get(
    //   'host'
    // )}/api/v1/users/resetPassword/${resetToken}`;

    // const url = `${req.protocol}://${req.get(
    //   'host'
    // )}/#/resetPassword/${resetToken}`;

    let url;

    if (process.env.NODE_ENV.trim() === 'production') {
      url = `https://gopendrajangir.github.io/howdoising/#/resetPassword/${resetToken}`;
    } else {
      url = `http://localhost:8000/howdoising/#/resetPassword/${resetToken}`;
    }

    await new Email(user, url).sendPasswordReset();
    res.status(200).json({
      status: 'success',
      message: 'Token sent to mail',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError('There was an error sending the mail. Try again later!', 500)
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const resetToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: resetToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();
  createSendToken(user, 200, req, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does no longer exist', 401)
    );
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401)
    );
  }

  req.user = currentUser;
  next();
});
