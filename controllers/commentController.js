const multer = require('multer');
const stream = require('stream');

const Comment = require('../models/commentModel');
const User = require('../models/userModel');
const Recording = require('../models/recordingModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
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
    fileSize: 2000000,
  },
});

exports.uploadVoiceComment = upload.single('voiceComment');

exports.getAllComments = (req, res, next) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};

const pushCommentNotification = async (recording, user, comment) => {
  await User.pushNotification(recording.user, {
    comment: {
      recording: {
        _id: recording._id,
        title: recording.title,
      },
      user: {
        _id: user._id,
        name: user.name,
        photo: user.photo,
      },
      textComment: comment.textComment,
      voiceComment: comment.voiceComment ? true : false,
    },
  });
  global.socket.emit('notify', recording.user);
};

exports.createComment = catchAsync(async (req, res, next) => {
  const { recordingId } = req.params;
  const userId = req.user.id;
  const { user } = req;
  const recording = await Recording.findById(recordingId);

  if (!recording) {
    return next(new AppError('Recording does not exist', 404));
  }

  const { textComment } = req.body;
  const commentData = { recording: recordingId, user: userId };
  if (textComment) {
    commentData.textComment = textComment;
  }

  if (req.file) {
    const bucket = gfs('recordingdata');
    const filename = `comment-${Date.now()}.mp3`;

    const uploadStream = bucket.openUploadStream(filename);
    const bufferStream = new stream.PassThrough();

    bufferStream.end(req.file.buffer);

    bufferStream.pipe(uploadStream);

    uploadStream.on('error', async (err) => {
      error(err, req, res, next);
    });

    uploadStream.on('finish', async (file) => {
      try {
        commentData.voiceComment = file._id;

        const comment = await Comment.create(commentData);

        if (!recording.user.equals(userId)) {
          await pushCommentNotification(recording, user, comment);
        }

        res.status(200).json({
          status: 'success',
          data: comment,
        });
      } catch (err) {
        error(err, req, res, next);
      }
    });
  } else {
    const comment = await Comment.create(commentData);

    if (!recording.user.equals(userId)) {
      await pushCommentNotification(recording, user, comment);
    }

    res.status(200).json({
      status: 'success',
      data: comment,
    });
  }
});

exports.getComment = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};

exports.updateComment = catchAsync(async (req, res, next) => {
  const { textComment } = req.body;
  const comment = await Comment.findByIdAndUpdate(
    req.params.id,
    {
      textComment,
    },
    { new: true }
  );

  if (!comment) {
    next(new AppError('Comment not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { comment },
  });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
  const { comment } = req;
  await comment.deleteComment();

  res.status(200).json({
    status: 'success',
  });
});

exports.protectComment = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { id: commentId, recordingId } = req.params;

  const recording = await Recording.findById(recordingId);

  if (!recording) {
    return next(new AppError('Recording not found', 404));
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  if (!recording.user.equals(userId) && !comment.user.equals(userId)) {
    return next(new AppError('Comment does not belong to you', 401));
  }

  if (`${comment.recording}` !== recordingId) {
    return next(new AppError('Comment does not belong to recording', 401));
  }

  req.comment = comment;
  next();
});
