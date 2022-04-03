const mongoose = require('mongoose');

const Comment = require('./commentModel');
const Rating = require('./ratingModel');

const gfs = require('../utils/gfs');

const recordingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide title for recording'],
      trim: true,
      maxlength: [
        40,
        'Recording title must have less than or equal to 40 characters',
      ],
      minlength: [
        8,
        'Recording title must have more than or equal to 8 characters',
      ],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [
        500,
        'Recording Description must have less than or equal to 500 characters',
      ],
      minlength: 0,
    },
    recording: {
      type: mongoose.Schema.ObjectId,
      ref: 'RecordingData',
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    ratingsAverage: {
      type: Number,
      default: 10,
      min: [1, 'Rating must be above 1'],
      max: [20, 'Rating must be below 20'],
      set: (val) => Math.round(val),
    },
    ratingsQuantity: { type: Number, default: 0 },
    commentsQuantity: { type: Number, default: 0 },
    active: {
      type: Boolean,
      deafult: true,
      select: false,
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

recordingSchema.virtual('ratings', {
  ref: 'Rating',
  foreignField: 'recording',
  localField: '_id',
});

recordingSchema.virtual('comments', {
  ref: 'Comment',
  foreignField: 'recording',
  localField: '_id',
});

recordingSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

recordingSchema.statics.deleteRecordings = async function (user) {
  await mongoose.connection.db.collection('recordingdata.files').deleteMany({
    _id: { $in: user.recordings.map((recording) => recording.recording) },
  });
  await this.deleteMany({ user: user.id });
  await Comment.deleteComments(this);
  await Rating.deleteMany({ recording: this.id });
};

recordingSchema.methods.deleteRecording = async function () {
  const bucket = gfs('recordingdata');

  await bucket.delete(this.recording);

  await this.deleteOne();
  await Comment.deleteComments(this);
  await Rating.deleteMany({ recording: this.id });
};

const Recording = mongoose.model('Recording', recordingSchema);

module.exports = Recording;
