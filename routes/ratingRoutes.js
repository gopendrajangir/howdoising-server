const express = require('express');
const ratingController = require('../controllers/ratingController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  // .get(ratingController.getAllRatings)
  .post(authController.protect, ratingController.createRating);

router
  .route('/:id')
  // .get(ratingController.getRating)
  .patch(
    authController.protect,
    ratingController.protectRating,
    ratingController.updateRating
  )
  .delete(
    authController.protect,
    ratingController.protectRating,
    ratingController.deleteRating
  );

module.exports = router;
