const express = require('express');
const router = express.Router();
const gamificationController = require('./controllers/gamification.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// GET /api/gamification/streak (xác thực qua Bearer Token hoặc query parameter ?user_id=123)
router.get('/streak', (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, gamificationController.getStreak);

module.exports = router;
