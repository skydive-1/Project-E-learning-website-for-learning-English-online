const express = require('express');
const router = express.Router();
const lessonsController = require('./controllers/lessons.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// GET /api/lessons - Lấy danh sách bài giảng (query: ?courseId=X hoặc ?sectionId=Y)
router.get('/', authenticate, lessonsController.getLessonsByQuery);

// POST /api/lessons - Tạo mới bài giảng (Chỉ Admin / Instructor)
router.post('/', authenticate, authorize([1, 2]), lessonsController.createLesson);

// PUT /api/lessons/:lessonId - Cập nhật bài giảng (Chỉ Admin / Instructor)
router.put('/:lessonId', authenticate, authorize([1, 2]), lessonsController.updateLesson);

// DELETE /api/lessons/:lessonId - Xóa bài giảng (Chỉ Admin / Instructor)
router.delete('/:lessonId', authenticate, authorize([1, 2]), lessonsController.deleteLesson);

module.exports = router;
