const express = require('express');
const commentController = require('../controllers/commentController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(commentController.getAllComments)
  .post(
    authController.protect,
    commentController.uploadVoiceComment,
    commentController.createComment
  );

router
  .route('/:id')
  // .get(commentController.getComment)
  .patch(
    authController.protect,
    commentController.protectComment,
    commentController.updateComment
  )
  .delete(
    authController.protect,
    commentController.protectComment,
    commentController.deleteComment
  );

module.exports = router;
