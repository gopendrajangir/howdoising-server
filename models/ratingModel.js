const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 20,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Rating must belong to a user'],
    },
    recording: {
      type: mongoose.Schema.ObjectId,
      ref: 'Recording',
      required: [true, 'Rating must belong to a recording'],
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

ratingSchema.index({ recording: 1, user: 1 }, { unique: true });

ratingSchema.methods.deleteRating = async function () {
  this.constructor.calcAverageRatings(this.recording);
  await this.deleteOne();
};

ratingSchema.statics.calcAverageRatings = async function (recordingId) {
  const stats = await this.aggregate([
    {
      $match: { recording: recordingId, active: { $ne: false } },
    },
    {
      $group: {
        _id: '$recording',
        nRatings: { $sum: 1 },
        avgRatings: { $avg: '$rating' },
      },
    },
  ]);

  // eslint-disable-next-line global-require
  const Recording = require('./recordingModel');

  if (stats.length > 0) {
    await Recording.findByIdAndUpdate(recordingId, {
      ratingsQuantity: stats[0].nRatings,
      ratingsAverage: stats[0].avgRatings,
    });
  } else {
    await Recording.findByIdAndUpdate(recordingId, {
      ratingsQuantity: 0,
      ratingsAverage: 10,
    });
  }
};

ratingSchema.post('save', async function () {
  await this.constructor.calcAverageRatings(this.recording);
});

ratingSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});

ratingSchema.post(/^findOneAnd/, async function () {
  if (!this.r) {
    this.r = await this.findOne();
  }
  await this.r.constructor.calcAverageRatings(this.r.recording);
});

// ratingSchema.post(/^findOneAnd/, async function (next) {
//   const rating = await this.findOne();
//   rating.constructor.calcAverageRatings(rating.recording);
// });

const Rating = mongoose.model('Rating', ratingSchema);
module.exports = Rating;
