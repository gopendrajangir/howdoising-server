const express = require('express');
const questionController = require('../controllers/questionController');
const authController = require('../controllers/authController');
const answerRouter = require('./answerRoutes');

const router = express.Router();

router.use('/:questionId/answers', answerRouter);

router
  .route('/')
  .get(questionController.getAllQuestions)
  .post(
    authController.protect,
    questionController.uploadVoiceQuestion,
    questionController.createQuestion
  );

router
  .route('/:id')
  .get(questionController.getQuestion)
  .patch(
    authController.protect,
    questionController.protectQuestion,
    questionController.updateQuestion
  )
  .delete(
    authController.protect,
    questionController.protectQuestion,
    questionController.deleteQuestion
  );

module.exports = router;
