const express = require('express');
const recordingController = require('../controllers/recordingController');
const authController = require('../controllers/authController');
const ratingRouter = require('./ratingRoutes');
const commentRouter = require('./commentRoutes');

const router = express.Router();

router.use('/:recordingId/ratings', ratingRouter);
router.use('/:recordingId/comments', commentRouter);

router
  .route('/')
  .get(recordingController.getAllRecordings)
  .post(
    authController.protect,
    recordingController.uploadUserRecording,
    recordingController.createRecording
  );

router
  .route('/:id')
  .get(recordingController.getRecording)
  // .patch(recordingController.updateRecording)
  .delete(authController.protect, recordingController.deleteRecording);

module.exports = router;
