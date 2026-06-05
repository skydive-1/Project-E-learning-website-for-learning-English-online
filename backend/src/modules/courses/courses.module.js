/**
 * Courses Module - Quản lý khóa học và bài học
 */

const express = require('express');
const router = express.Router();

// Mock endpoints cho courses
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Lấy danh sách khóa học thành công (Placeholder)',
    courses: [
      { id: 1, title: 'English for Beginners', description: 'Basic English grammar and vocabulary' },
      { id: 2, title: 'Intermediate English Communication', description: 'Improve your speaking and listening skills' }
    ]
  });
});

module.exports = router;
