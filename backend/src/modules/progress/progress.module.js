/**
 * Progress Module - Quản lý tiến độ học tập của người dùng
 */

const express = require('express');
const router = express.Router();

// Mock endpoints cho progress
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  res.status(200).json({
    success: true,
    message: 'Lấy tiến trình học tập thành công (Placeholder)',
    progress: {
      userId,
      completedLessons: [1, 2],
      overallProgressPercentage: 45
    }
  });
});

module.exports = router;
