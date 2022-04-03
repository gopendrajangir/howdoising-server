const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const notificationSchema = new mongoose.Schema({
  rating: {
    type: Object,
  },
  comment: {
    type: Object,
  },
  answer: {
    type: Object,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: 'String',
      required: [true, 'Please provide your name'],
      minlength: 5,
      maxlength: 20,
    },
    email: {
      type: 'String',
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    photo: {
      type: mongoose.Schema.ObjectId,
      ref: 'Photos',
    },
    notifications: [notificationSchema],
    unreadNotifications: {
      type: Number,
      default: 0,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      maxlength: 100,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: 'Passwords are not the same!',
      },
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    active: {
      type: Boolean,
      default: true,
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

userSchema.virtual('recordings', {
  ref: 'Recording',
  foreignField: 'user',
  localField: '_id',
});

userSchema.virtual('ratings', {
  ref: 'Rating',
  foreignField: 'user',
  localField: '_id',
});

userSchema.virtual('comments', {
  ref: 'Comment',
  foreignField: 'user',
  localField: '_id',
});

userSchema.virtual('questions', {
  ref: 'Question',
  foreignField: 'user',
  localField: '_id',
});

userSchema.virtual('answers', {
  ref: 'Answer',
  foreignField: 'user',
  localField: '_id',
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || this.isNew) next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.statics.pushNotification = async function (userId, notification) {
  await this.findByIdAndUpdate(userId, {
    $inc: {
      unreadNotifications: 1,
    },
    $push: {
      notifications: notification,
    },
  });
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (!this.passwordChangedAt) return false;
  return parseInt(this.passwordChangedAt.getTime() / 1000, 10) > JWTTimestamp;
};

userSchema.methods.correctPassword = async (candidatePassword, password) => {
  return await bcrypt.compare(candidatePassword, password);
};

userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
  return verificationToken;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
