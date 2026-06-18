/**
 * Progress Routes - Định nghĩa endpoints cho Module Progress
 */

const express = require('express');
const router = express.Router();
const progressController = require('./controllers/progress.controller');
const validate = require('../../middleware/validation.middleware');

// Schema Validation
const getProgressSchema = {
  params: {
    userId: { required: true }
  }
};

// GET /api/progress/:userId
router.get('/:userId', validate(getProgressSchema), progressController.getProgressByUserId);

// POST /api/progress - Ghi nhận tiến độ học tập
router.post('/', progressController.recordProgress);

module.exports = router;
