/**
 * Courses Routes - Định nghĩa endpoints cho Module Courses
 */

const express = require('express');
const router = express.Router();
const coursesController = require('./controllers/courses.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');

// GET /api/courses - Lấy danh sách khóa học công khai
router.get('/', coursesController.getAllCourses);

// GET /api/courses/subjects - Lấy danh sách môn học
router.get('/subjects', coursesController.getSubjects);

// GET /api/courses/lessons/:lessonId - Lấy chi tiết bài học
router.get('/lessons/:lessonId', authenticate, coursesController.getLessonById);

// POST /api/courses/upload - Tải lên bài giảng (video/pdf)
router.post('/upload', authenticate, authorize([1, 2]), upload.single('file'), coursesController.uploadFile);

// POST /api/courses - Tạo mới khóa học kèm chương và bài học
router.post('/', authenticate, authorize([1, 2]), coursesController.createCourse);

module.exports = router;
