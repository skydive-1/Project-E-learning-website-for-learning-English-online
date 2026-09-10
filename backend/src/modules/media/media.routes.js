const express = require('express');
const mediaController = require('./media.controller');
const { authenticatePublicVideoToken } = require('../../middleware/auth.middleware');
const { mediaTicketLimiter, streamingLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

router.get('/video/ticket', mediaTicketLimiter, mediaController.getPublicVideoTicket);
router.get('/video/stream/:assetId', authenticatePublicVideoToken, streamingLimiter, mediaController.streamPublicVideo);

module.exports = router;
