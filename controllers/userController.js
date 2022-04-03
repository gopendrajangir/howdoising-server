const stream = require('stream');
const multer = require('multer');
const sharp = require('sharp');

const gfs = require('../utils/gfs');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const User = require('../models/userModel');
const Recording = require('../models/recordingModel');
const Question = require('../models/questionModel');

const error = require('./errorController');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

// exports.getAllUsers = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'This route is not yet defined!',
//   });
// };

// exports.createUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'This route is not yet defined!',
//   });
// };

// exports.updateUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'This route is not yet defined!',
//   });
// };

// exports.deleteUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'This route is not yet defined!',
//   });
// };

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('name photo')
    .populate({
      path: 'recordings',
      select: 'title description',
    })
    .populate({
      path: 'ratings',
      select: 'rating recording',
      populate: {
        path: 'recording',
        select: 'title description',
      },
    })
    .populate({
      path: 'comments',
      select: 'textComment voiceComment',
      populate: {
        path: 'recording',
        select: 'title description',
      },
    })
    .populate({
      path: 'questions',
      select: 'title textQuestion voiceQuestion',
    })
    .populate({
      path: 'answers',
      select: 'textAnswer voiceAnswer',
    });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

exports.me = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .populate({
      path: 'recordings',
      select: 'title description',
    })
    .populate({
      path: 'ratings',
      select: 'rating recording',
      populate: {
        path: 'recording',
        select: 'title description',
        populate: {
          path: 'user',
          select: 'name photo',
        },
      },
    })
    .populate({
      path: 'comments',
      select: 'textComment voiceComment',
      populate: {
        path: 'recording',
        select: 'title description',
        populate: {
          path: 'user',
          select: 'name photo',
        },
      },
    })
    .populate({
      path: 'questions',
      select: 'title textQuestion voiceQuestion',
    })
    .populate({
      path: 'answers',
      select: 'textAnswer voiceAnswer',
    });

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

const filterObj = (obj, allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

const updateAndSendResponse = async (id, filteredBody, res) => {
  const user = await User.findByIdAndUpdate(id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
};

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password update. Please use /updateMyPassword.',
        400
      )
    );
  }

  const filteredBody = filterObj(req.body, ['name']);

  if (req.file) {
    req.filename = `user-${req.user.id}-${new Date()}.jpeg`;

    const outputBuffer = await sharp(req.file.buffer)
      .resize(500, 500)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toBuffer();

    const bucket = gfs('photos');

    if (req.user.photo) {
      await bucket.delete(req.user.photo);
    }

    const uploadStream = bucket.openUploadStream(req.filename);
    const bufferStream = new stream.PassThrough();

    bufferStream.end(outputBuffer);

    bufferStream.pipe(uploadStream);

    uploadStream.on('error', (err) => {
      if (!Object.keys(filteredBody).length) {
        next(new AppError('Error while uploading photo', 401));
      } else {
        updateAndSendResponse(req.user.id, filteredBody, res);
      }
    });

    uploadStream.on('finish', (file) => {
      filteredBody.photo = file._id;
      updateAndSendResponse(req.user.id, filteredBody, res);
    });
  } else {
    updateAndSendResponse(req.user.id, filteredBody, res);
  }
});

exports.updateMyPassword = catchAsync(async (req, res, next) => {
  const { password, newPassword, newPasswordConfirm } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  if (
    !password ||
    !user ||
    !(await user.correctPassword(password, user.password))
  ) {
    next(new AppError('Incorrect password', 401));
  }

  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;

  await user.save();

  next();
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  const { id } = req.user;

  await User.findByIdAndUpdate(id, { active: false });

  await Recording.findOneAndUpdate(
    {
      user: id,
    },
    {
      active: false,
    }
  );

  await Question.findOneAndUpdate(
    {
      user: id,
    },
    {
      active: false,
    }
  );

  next();
});

exports.readAllNotifications = catchAsync(async (req, res, next) => {
  const { user } = req;

  user.unreadNotifications = 0;

  const updatedUser = await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    data: updatedUser,
  });
});

exports.unreadNotifications = catchAsync(async (req, res, next) => {
  const { user } = req;

  res.status(200).json({
    status: 'success',
    data: user,
  });
});
