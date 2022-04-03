const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.subscribeToPosts = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
  });
});
