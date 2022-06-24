const express = require('express');

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/loginWithCookie', authController.loginWithCookie);
router.get('/logout', authController.logout);
router.patch('/verify/:token', authController.verifyEmail);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// router.route('/');
// .get(userController.getAllUsers)
// .post(userController.createUser);

router.use(authController.protect);

router.get('/me', userController.me);
router.patch(
  '/updateMe',
  userController.uploadUserPhoto,
  userController.updateMe
);
router.patch(
  '/updateMyPassword',
  userController.updateMyPassword,
  authController.logout
);
router.delete('/deleteMe', userController.deleteMe, authController.logout);

router.route('/:id').get(userController.getUser);
// .patch(userController.updateUser)
// .delete(userController.deleteUser);

router
  .route('/notifications/readAllNotifications')
  .get(userController.readAllNotifications);

router.route('/notifications/unread').get(userController.unreadNotifications);

module.exports = router;
