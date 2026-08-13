const express = require('express');
const router = express.Router();

const gamificationController = require('./controllers/gamification.controller');

// GET /api/gamification/streak?user_id=123
router.get('/streak', gamificationController.getStreak);

module.exports = router;
