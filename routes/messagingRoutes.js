const express = require('express');

const messagingController = require('../controllers/messagingController');

const router = express.Router();

router.get('/subscribe/new_post', messagingController.subscribeToPosts);

module.exports = router;
