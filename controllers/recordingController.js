const multer = require('multer');
const stream = require('stream');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const Recording = require('../models/recordingModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const gfs = require('../utils/gfs');

const error = require('./errorController');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an Audio', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 5000000,
  },
});

exports.uploadUserRecording = upload.single('recording');

exports.getAllRecordings = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Recording.find().populate({
      path: 'user',
      select: 'name photo',
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  let userId;

  const token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );
      userId = decoded.id;
    } catch (err) {
      console.log('Its ohk');
    }
  }

  let recordings = await features.query
    .populate({
      path: 'ratings',
      select: 'rating user',
      match: { user: userId },
    })
    .populate({
      path: 'comments',
      select: 'user',
      match: { user: userId },
    });

  recordings = recordings.map((recording) => {
    recording = recording.toObject();

    recording.userRated = recording.ratings.length
      ? recording.ratings[0].rating
      : false;
    recording.userCommented = recording.comments.length ? true : false;

    delete recording.ratings;
    delete recording.comments;
    return recording;
  });

  res.status(200).json({
    status: 'success',
    data: recordings,
  });
});

exports.createRecording = catchAsync(async (req, res, next) => {
  const { title } = req.body;

  if (!title) {
    return next(new AppError('Please provide title', 400));
  } else if (title.trim().length < 8) {
    return next(new AppError('Title must be atleast 8 characters long', 400));
  } else if (title.trim().length > 40) {
    return next(
      new AppError('Title must be less than or equal to 40 characters', 400)
    );
  }

  const duration = req.file.buffer.duration;

  if (duration > 90) {
    return next(new AppError('Recording too long', 400));
  }

  const userId = req.user.id;
  const filename = `recording-${Date.now()}.mp3`;

  const bucket = gfs('recordingdata');

  const uploadStream = bucket.openUploadStream(filename);
  const bufferStream = new stream.PassThrough();

  bufferStream.end(req.file.buffer);

  bufferStream.pipe(uploadStream);

  uploadStream.on('error', async (err) => {
    error(err, req, res, next);
  });

  uploadStream.on('finish', async (file) => {
    try {
      const recording = await Recording.create({
        title: req.body.title,
        description: req.body.description,
        user: userId,
        recording: file._id,
        duration,
      });

      global.socket.emit('new_post', 'post');

      res.status(200).json({
        status: 'success',
        data: {
          recording,
        },
      });
    } catch (err) {
      error(err, req, res, next);
    }
  });
});

exports.getRecording = catchAsync(async (req, res, next) => {
  const recording = await Recording.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'name photo',
    })
    .populate({
      path: 'ratings',
      select: 'rating updatedAt',
      populate: {
        path: 'user',
        select: 'name photo',
      },
    })
    .populate({
      path: 'comments',
      select: 'textComment voiceComment createdAt',
      populate: {
        path: 'user',
        select: 'name photo',
      },
    });

  if (!recording) {
    return next(new AppError('Recording not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: recording,
  });
});

exports.updateRecording = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};

exports.deleteRecording = catchAsync(async (req, res, next) => {
  const { user } = req;
  const recording = await Recording.findById(req.params.id).populate({
    path: 'comments',
    select: 'textComment voiceComment',
    populate: {
      path: 'user',
      select: 'name photo',
    },
  });

  if (!recording) {
    return next(new AppError('Recording not found', 404));
  }

  if (!user._id.equals(recording.user)) {
    return next(new AppError('This Recording does not belong to you', 401));
  }

  await recording.deleteRecording();

  res.status(200).json({
    status: 'success',
    message: 'Recording deleted successfully',
  });
});
