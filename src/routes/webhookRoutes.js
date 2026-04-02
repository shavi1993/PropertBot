const express = require('express');
const router = express.Router();
const { verifyWebhook, handleMessage } = require('../controllers/webhookController');

// Meta calls this to verify your webhook URL
router.get('/', verifyWebhook);

// Meta calls this every time a user sends a message
router.post('/', handleMessage);

module.exports = router;