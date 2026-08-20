const express = require('express');
const router = express.Router();
const gamificationController = require('./controllers/gamification.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// GET /api/gamification/streak - bắt buộc xác thực Bearer token
router.get('/streak', authenticate, gamificationController.getStreak);

// GET /api/gamification/badges - bắt buộc xác thực Bearer token
router.get('/badges', authenticate, gamificationController.getBadges);

module.exports = router;
