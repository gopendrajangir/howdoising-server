const mongoose = require('mongoose');
const Answer = require('./answerModel');
const gfs = require('../utils/gfs');

const questionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide title for question'],
      trim: true,
      maxlength: [
        50,
        'Question title must have less or equal than 50 characters',
      ],
      minlength: [
        20,
        'Question title must have more or equal than 10 characters',
      ],
    },
    textQuestion: {
      type: String,
      maxlength: [
        1000,
        'Question must have less or equal than 1000 characters|',
      ],
      minlength: [1, 'Question must have more or equal than 1 character'],
      required: [
        function () {
          return !this.voiceQuestion;
        },
        'Question can not be empty',
      ],
    },
    voiceQuestion: {
      type: mongoose.Schema.ObjectId,
      ref: 'RecordingData',
      required: [
        function () {
          return !this.textQuestion;
        },
        'Question can not be empty',
      ],
    },
    answersQuantity: { type: Number, default: 0 },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Question must belong to a user'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
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

questionSchema.virtual('answers', {
  ref: 'Answer',
  foreignField: 'question',
  localField: '_id',
});

questionSchema.statics.deleteQuestions = async function (user) {
  if (user.questions && user.questions.length) {
    await mongoose.connection.db.collection('recordingdata.files').deleteMany({
      _id: { $in: user.questions.map((question) => question.voiceQuestion) },
    });
  }
  await this.deleteMany({ user: user.id });
};

questionSchema.methods.deleteQuestion = async function () {
  if (this.voiceQuestion) {
    const bucket = gfs('recordingdata');

    await bucket.delete(this.voiceQuestion);
  }

  await Answer.deleteAnswers(this);
  await this.deleteOne();
};

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
