const multer = require('multer');
const stream = require('stream');

const Question = require('../models/questionModel');

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

exports.uploadVoiceQuestion = upload.single('voiceQuestion');

exports.getAllQuestions = catchAsync(async (req, res, next) => {
  const questions = await Question.find().populate({
    path: 'user',
    select: 'name photo',
  });

  res.status(200).json({
    status: 'success',
    data: {
      questions,
    },
  });
});

const saveQuestion = async (req, res, next, questionData) => {
  const question = await Question.create(questionData);

  res.status(200).json({
    status: 'success',
    data: {
      question,
    },
  });
};

exports.createQuestion = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const { title, textQuestion } = req.body;
  const questionData = { title, user: userId };

  if (textQuestion) {
    questionData.textQuestion = textQuestion;
  }

  if (req.file) {
    const bucket = gfs('recordingdata');
    const filename = `question-${Date.now()}.mp3`;

    const uploadStream = bucket.openUploadStream(filename);
    const bufferStream = new stream.PassThrough();

    bufferStream.end(req.file.buffer);

    bufferStream.pipe(uploadStream);

    uploadStream.on('error', async (err) => {
      error(err, req, res, next);
    });

    uploadStream.on('finish', async (file) => {
      try {
        questionData.voiceQuestion = file._id;
        saveQuestion(req, res, next, questionData);
      } catch (err) {
        error(err, req, res, next);
      }
    });
  } else {
    saveQuestion(req, res, next, questionData);
  }
});

exports.getQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'name photo',
    })
    .populate({
      path: 'answers',
      populate: {
        path: 'user',
        select: 'name photo',
      },
    });

  res.status(500).json({
    status: 'success',
    data: { question },
  });
});

exports.updateQuestion = catchAsync(async (req, res, next) => {
  const { textQuestion, title } = req.body;
  const questionData = { textQuestion, title };
  const question = await Question.findByIdAndUpdate(
    req.params.id,
    questionData,
    { new: true }
  );

  if (!question) {
    next(new AppError('Question not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { question },
  });
});

exports.deleteQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.question._id)
    .populate({
      path: 'user',
      select: 'name photo',
    })
    .populate({
      path: 'answers',
      populate: {
        path: 'user',
        select: 'name photo',
      },
    });

  await question.deleteQuestion();

  res.status(200).json({
    status: 'success',
  });
});

exports.protectQuestion = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError('Question not found', 404));
  }
  if (!question.user.equals(userId)) {
    return next(new AppError('Question does not belong to you', 401));
  }

  req.question = question;
  next();
});
