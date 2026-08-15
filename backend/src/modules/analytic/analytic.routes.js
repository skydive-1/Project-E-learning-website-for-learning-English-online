const express = require('express');
const router = express.Router();
const analyticsController = require('./controllers/analytic.controllers');
const { authenticate } = require('../../middleware/auth.middleware');

router.get('/user-heatmap', authenticate, analyticsController.getUserHeatmap);
router.get('/summary', authenticate, analyticsController.getUserAnalyticsSummary);
router.post('/heartbeat', authenticate, analyticsController.trackHeartbeat);

module.exports = router;