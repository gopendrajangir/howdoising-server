const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const Rating = require('../models/ratingModel');
const User = require('../models/userModel');
const Recording = require('../models/recordingModel');

exports.getAllRatings = (req, res, next) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};

exports.createRating = catchAsync(async (req, res, next) => {
  const { recordingId } = req.params;
  const userId = req.user.id;
  const { user } = req;
  const recording = await Recording.findById(recordingId);

  if (!recording) {
    return next(new AppError('Recording does not exist', 404));
  }

  if (recording.user.equals(userId)) {
    return next(new AppError('You can not rate your own post', 400));
  }

  const existingRating = await Rating.findOne({
    recording: recordingId,
    user: userId,
  });

  let rating;

  if (existingRating) {
    existingRating.rating = req.body.rating;
    rating = await existingRating.save();
  } else {
    rating = await Rating.create({
      rating: req.body.rating,
      recording: recordingId,
      user: userId,
    });
  }

  await User.pushNotification(recording.user, {
    rating: {
      recording: {
        _id: recording._id,
        title: recording.title,
      },
      rating: rating.rating,
      user: {
        _id: userId,
        name: user.name,
        photo: user.photo,
      },
    },
  });

  global.socket.emit('notify', recording.user);

  res.status(200).json({
    status: 'success',
    data: rating,
  });
});

exports.getRating = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};

exports.updateRating = catchAsync(async (req, res, next) => {
  const rating = await Rating.findByIdAndUpdate(
    req.params.id,
    {
      rating: req.body.rating,
    },
    { new: true }
  );

  if (!rating) {
    next(new AppError('Rating not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { rating },
  });
});

exports.deleteRating = catchAsync(async (req, res, next) => {
  const { rating } = req;
  await rating.deleteRating();

  res.status(200).json({
    status: 'success',
  });
});

exports.protectRating = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { id: ratingId, recordingId } = req.params;

  const recording = await Recording.findById(recordingId);

  if (!recording) {
    return next(new AppError('Recording not found', 404));
  }

  const rating = await Rating.findById(ratingId);

  if (!rating) {
    return next(new AppError('Rating not found', 404));
  }

  if (!rating.user.equals(userId)) {
    return next(new AppError('Rating does not belong to you', 401));
  }
  if (`${rating.recording}` !== recordingId) {
    return next(new AppError('Rating does not belong to recording', 401));
  }

  req.rating = rating;
  next();
});
