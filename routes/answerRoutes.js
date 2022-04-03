const express = require('express');
const answerController = require('../controllers/answerController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(answerController.getAllAnswers)
  .post(
    authController.protect,
    answerController.uploadVoiceAnswer,
    answerController.createAnswer
  );

router
  .route('/:id')
  // .get(answerController.getAnswer)
  .patch(
    authController.protect,
    answerController.protectAnswer,
    answerController.updateAnswer
  )
  .delete(
    authController.protect,
    answerController.protectAnswer,
    answerController.deleteAnswer
  );

module.exports = router;
