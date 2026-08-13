const express = require('express');
const router = express.Router();
const analyticsController = require('./controllers/analytic.controllers');
const { authenticate } = require('../../middleware/auth.middleware');

const optionalAuth = (req, res, next) => {
    if (req.headers.authorization) {
        return authenticate(req, res, next);
    }
    next();
};

router.get('/user-heatmap', optionalAuth, analyticsController.getUserHeatmap);
router.get('/summary', optionalAuth, analyticsController.getUserAnalyticsSummary);

module.exports = router;