/**
 * Progress Routes - Định nghĩa endpoints cho Module Progress
 */

const express = require('express');
const router = express.Router();
const progressController = require('./controllers/progress.controller');
const validate = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');

// Schema Validation
const getProgressSchema = {
  params: {
    userId: { required: true }
  }
};

/**
 * @swagger
 * tags:
 *   name: Progress
 *   description: API for managing user learning progress
 */

/**
 * @swagger
 * /api/progress/{userId}:
 *   get:
 *     summary: Lấy tiến độ học tập của một user
 *     tags: [Progress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID của người dùng
 *     responses:
 *       200:
 *         description: Thành công
 *       401:
 *         description: Chưa xác thực
 */

// GET /api/progress/:userId
router.get('/:userId', authenticate, validate(getProgressSchema), progressController.getProgressByUserId);

/**
 * @swagger
 * /api/progress:
 *   post:
 *     summary: Ghi nhận hoặc cập nhật tiến độ học tập (Upsert)
 *     tags: [Progress]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonId:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [completed, in_progress]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       201:
 *         description: Tạo mới thành công
 */

// POST /api/progress - Ghi nhận tiến độ học tập
router.post('/', authenticate, progressController.recordProgress);

module.exports = router;
