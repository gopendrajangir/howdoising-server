const mongoose = require('mongoose');

const gfs = require('../utils/gfs');

const commentSchema = new mongoose.Schema(
  {
    textComment: {
      type: String,
      maxlength: [256, 'Comment must have less or equal than 256 characters|'],
      minlength: [1, 'Comment must have more or equal than 1 character'],
      required: [
        function () {
          return !this.voiceComment;
        },
        'Comment can not be empty',
      ],
    },
    voiceComment: {
      type: mongoose.Schema.ObjectId,
      ref: 'RecordingData',
      required: [
        function () {
          return !this.textComment;
        },
        'Comment can not be empty',
      ],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Comment must belong to a user'],
    },
    recording: {
      type: mongoose.Schema.ObjectId,
      ref: 'Recording',
      required: [true, 'Comment must belong to a recording'],
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
  { versionKey: false }
);

commentSchema.statics.countComments = async function (recordingId) {
  const stats = await this.aggregate([
    {
      $match: { recording: recordingId, active: { $ne: false } },
    },
    {
      $group: {
        _id: '$recording',
        nComments: { $sum: 1 },
      },
    },
  ]);

  // eslint-disable-next-line global-require
  const Recording = require('./recordingModel');

  if (stats.length > 0) {
    await Recording.findByIdAndUpdate(recordingId, {
      commentsQuantity: stats[0].nComments,
    });
  } else {
    await Recording.findByIdAndUpdate(recordingId, {
      commentsQuantity: 0,
    });
  }
};

commentSchema.post('save', async function () {
  await this.constructor.countComments(this.recording);
});

commentSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});

commentSchema.post(/^findOneAnd/, async function () {
  this.r.constructor.countComments(this.r.recording);
});

commentSchema.methods.decreaseCommentsQuantity = async function () {
  // eslint-disable-next-line global-require
  const Recording = require('./recordingModel');

  await Recording.findByIdAndUpdate(this.recording, {
    $inc: { commentsQuantity: -1 },
  });
};

commentSchema.statics.deleteComments = async function (recording) {
  await mongoose.connection.db.collection('recordingdata.files').deleteMany({
    _id: { $in: recording.comments.map((comment) => comment.voiceComment) },
  });
  await this.deleteMany({ recording: recording._id });
};

commentSchema.methods.deleteComment = async function () {
  if (this.voiceComment) {
    const bucket = gfs('recordingdata');

    await bucket.delete(this.voiceComment);
  }
  await this.decreaseCommentsQuantity();
  await this.deleteOne();
};

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;
