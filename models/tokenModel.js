const mongoose = require('mongoose');
const validator = require('validator');
const crypto = require('crypto');

const tokenSchema = new mongoose.Schema({
  name: {
    type: 'String',
    required: [true, 'Please provide your name'],
  },
  email: {
    type: 'String',
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

tokenSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
  return verificationToken;
};

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
