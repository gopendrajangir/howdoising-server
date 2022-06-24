const mongoose = require('mongoose');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const gfs = require('../utils/gfs');

exports.streamRecording = catchAsync(async (req, res, next) => {
  const _id = mongoose.Types.ObjectId(req.params.id);
  const bucket = gfs('recordingdata');

  const recording = await mongoose.connection.db
    .collection('recordingdata.files')
    .findOne({ _id });

  if (!recording) {
    return next(new AppError('File not found', 404));
  }

  const downloadStream = bucket.openDownloadStream(_id);

  downloadStream.pipe(res);
});

exports.streamPhoto = catchAsync(async (req, res, next) => {
  const _id = mongoose.Types.ObjectId(req.params.id);
  const bucket = gfs('photos');

  const recording = await mongoose.connection.db
    .collection('photos.files')
    .findOne({ _id });

  if (!recording) {
    return next(new AppError('File not found', 404));
  }

  const downloadStream = bucket.openDownloadStream(_id);

  downloadStream.pipe(res);
});
