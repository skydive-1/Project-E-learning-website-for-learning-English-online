const express = require('express');
const router = express.Router();
const gamificationController = require('./controllers/gamification.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// GET /api/gamification/streak - bắt buộc xác thực Bearer token
router.get('/streak', authenticate, gamificationController.getStreak);

// GET /api/gamification/badges - bắt buộc xác thực Bearer token
router.get('/badges', authenticate, gamificationController.getBadges);

// GET /api/gamification/summary - snapshot streak + badges từ dữ liệu học tập thật
router.get('/summary', authenticate, gamificationController.getSummary);

// POST /api/gamification/resync - Admin rà soát điều kiện huy hiệu cho mọi user
router.post('/resync', authenticate, authorize([1]), gamificationController.resyncAllBadges);

module.exports = router;
