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

// GET /api/courses/:courseId - Lấy chi tiết khóa học kèm chương và bài học
router.get('/:courseId', coursesController.getCourseById);

// GET /api/courses/lessons/:lessonId - Lấy chi tiết bài học
router.get('/lessons/:lessonId', authenticate, coursesController.getLessonById);

// POST /api/courses/upload - Tải lên bài giảng (video/pdf)
router.post('/upload', authenticate, authorize([1, 2]), upload.single('file'), coursesController.uploadFile);

// POST /api/courses - Tạo mới khóa học kèm chương và bài học
router.post('/', authenticate, authorize([1, 2]), coursesController.createCourse);

// PUT /api/courses/:courseId - Cập nhật thông tin khóa học
router.put('/:courseId', authenticate, authorize([1, 2]), coursesController.updateCourse);

// DELETE /api/courses/:courseId - Xóa khóa học
router.delete('/:courseId', authenticate, authorize([1, 2]), coursesController.deleteCourse);

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: API quản lý khóa học
 * 
 * /api/courses:
 *   get:
 *     summary: Lấy danh sách khóa học
 *     tags: [Courses]
 *   post:
 *     summary: Tạo khóa học mới
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 * 
 * /api/courses/subjects:
 *   get:
 *     summary: Lấy danh sách môn học
 *     tags: [Courses]
 * 
 * /api/courses/{courseId}:
 *   get:
 *     summary: Lấy chi tiết khóa học
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *   put:
 *     summary: Cập nhật khóa học
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *   delete:
 *     summary: Xóa khóa học
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 * 
 * /api/courses/lessons/{lessonId}:
 *   get:
 *     summary: Lấy chi tiết bài học
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 * 
 * /api/courses/upload:
 *   post:
 *     summary: Tải lên file
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 */
module.exports = router;
