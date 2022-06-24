const multer = require('multer');
const stream = require('stream');

const Question = require('../models/questionModel');
const User = require('../models/userModel');
const Answer = require('../models/answerModel');

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

exports.uploadVoiceAnswer = upload.single('voiceAnswer');

exports.getAllAnswers = catchAsync(async (req, res, next) => {
  const { questionId } = req.params;

  const filter = {};

  if (questionId) {
    filter.question = questionId;
    const question = await Question.findById(questionId);
    if (!question) {
      return next(new AppError('Question not found', 404));
    }
  }

  const answers = await Answer.find(filter).populate({
    path: 'user',
    select: 'name photo',
  });

  res.status(200).json({
    status: 'success',
    data: {
      answers,
    },
  });
});

const pushAnswerNotification = async (question, user, answer) => {
  await User.pushNotification(question._id, {
    answer: {
      question: {
        _id: question._id,
        title: question.title,
      },
      user: {
        _id: user._id,
        name: user.name,
        photo: user.photo,
      },
      textAnswer: answer.textAnswer,
      voiceAnswer: answer.voiceAnswer ? true : false,
    },
  });
  global.socket.emit('notify', question.user);
};

exports.createAnswer = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { questionId } = req.params;
  const { user } = req;

  const question = await Question.findById(questionId);

  if (!question) {
    return next(new AppError('Question not found', 404));
  }

  const { textAnswer } = req.body;
  const answerData = { user: userId, question: questionId };

  if (textAnswer) {
    answerData.textAnswer = textAnswer;
  }

  if (req.file) {
    const bucket = gfs('recordingdata');
    const filename = `answer-${Date.now()}.mp3`;

    const uploadStream = bucket.openUploadStream(filename);
    const bufferStream = new stream.PassThrough();

    bufferStream.end(req.file.buffer);

    bufferStream.pipe(uploadStream);

    uploadStream.on('error', async (err) => {
      error(err, req, res, next);
    });

    uploadStream.on('finish', async (file) => {
      try {
        answerData.voiceAnswer = file._id;

        const answer = await Answer.create(answerData);

        if (!question.user.equals(userId)) {
          await pushAnswerNotification(question, user, answer);
        }

        res.status(200).json({
          status: 'success',
          data: {
            answer,
          },
        });
      } catch (err) {
        error(err, req, res, next);
      }
    });
  } else {
    const answer = await Answer.create(answerData);

    await pushAnswerNotification(question, user, answer);

    res.status(200).json({
      status: 'success',
      data: { answer },
    });
  }
});

exports.getAnswer = catchAsync(async (req, res, next) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined',
  });
});

exports.updateAnswer = catchAsync(async (req, res, next) => {
  const { textAnswer } = req.body;
  const answer = await Answer.findByIdAndUpdate(
    req.params.id,
    {
      textAnswer,
    },
    { new: true }
  );

  if (!answer) {
    next(new AppError('Answer not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { answer },
  });
});

exports.deleteAnswer = catchAsync(async (req, res, next) => {
  const { answer } = req;
  await answer.deleteAnswer();

  res.status(200).json({
    status: 'success',
  });
});

exports.protectAnswer = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { questionId, id: answerId } = req.params;

  const question = await Question.findById(questionId);

  if (!question) {
    return next(new AppError('Question not found', 404));
  }

  const answer = await Answer.findById(answerId);

  if (!answer) {
    return next(new AppError('Answer not found', 404));
  }

  if (!answer.user.equals(userId)) {
    return next(new AppError('Answer does not belong to you', 401));
  }
  if (`${answer.question}` !== questionId) {
    return next(new AppError('Answer does not belong to question', 401));
  }

  req.question = question;
  req.answer = answer;
  next();
});
