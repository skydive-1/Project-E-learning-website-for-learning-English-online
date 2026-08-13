const express = require('express');
const router = express.Router();

const analyticsController = require('./controllers/analytic.controllers');

router.get(
    '/user-heatmap',
    analyticsController.getUserHeatmap
);

module.exports = router;