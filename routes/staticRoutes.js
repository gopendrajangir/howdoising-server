const express = require('express');
const staticController = require('../controllers/staticController');

const router = express.Router();

router.route('/recordings/:id').get(staticController.streamRecording);
router.route('/images/:id').get(staticController.streamPhoto);

module.exports = router;
