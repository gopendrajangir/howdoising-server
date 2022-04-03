const mongoose = require('mongoose');

const gfs = require('../utils/gfs');

const answerSchema = new mongoose.Schema(
  {
    textAnswer: {
      type: String,
      maxlength: [1000, 'Answer must have less or equal than 1000 characters|'],
      minlength: [1, 'Answer must have more or equal than 1 character'],
      required: [
        function () {
          return !this.voiceAnswer;
        },
        'Answer can not be empty',
      ],
    },
    voiceAnswer: {
      type: mongoose.Schema.ObjectId,
      ref: 'RecordingData',
      required: [
        function () {
          return !this.textAnswer;
        },
        'Answer can not be empty',
      ],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Answer must belong to a user'],
    },
    question: {
      type: mongoose.Schema.ObjectId,
      ref: 'Answer',
    },
  },
  {
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

answerSchema.statics.countAnswers = async function (questionId) {
  const stats = await this.aggregate([
    {
      $match: { question: questionId },
    },
    {
      $group: {
        _id: '$question',
        answersQuantity: { $sum: 1 },
      },
    },
  ]);

  // eslint-disable-next-line global-require
  const Question = require('./questionModel');

  if (stats.length) {
    await Question.findByIdAndUpdate(questionId, {
      answersQuantity: stats[0].answersQuantity,
    });
  } else {
    await Question.findByIdAndUpdate(questionId, {
      answersQuantity: 0,
    });
  }
};

answerSchema.post('save', async function () {
  await this.constructor.countAnswers(this.question);
});

answerSchema.methods.decreaseAnswersQuantity = async function () {
  // eslint-disable-next-line global-require
  const Question = require('./questionModel');

  await Question.findByIdAndUpdate(this.question, {
    $inc: { answersQuantity: -1 },
  });
};

answerSchema.statics.deleteAnswers = async function (question) {
  if (question.answers && question.answers.length) {
    await mongoose.connection.db.collection('recordingdata.files').deleteMany({
      _id: { $in: question.answers.map((answer) => answer.voiceAnswer) },
    });
  }
  await this.deleteMany({ question: question.id });
};

answerSchema.methods.deleteAnswer = async function () {
  if (this.voiceAnswer) {
    const bucket = gfs('recordingdata');

    await bucket.delete(this.voiceAnswer);
  }
  await this.deleteOne();
  await this.decreaseAnswersQuantity();
};

const Answer = mongoose.model('Answer', answerSchema);

module.exports = Answer;
