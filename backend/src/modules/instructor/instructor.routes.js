/**
 * Instructor Routes - Định nghĩa endpoints cho Module Instructor
 */

const express = require('express');
const router = express.Router();
const instructorController = require('./controllers/instructor.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Áp dụng bảo mật cho toàn bộ các route trong module này
router.use(authenticate);
router.use(authorize([1, 2])); // Chỉ Admin (1) và Instructor (2) mới truy cập được

// GET /api/instructor/students - Lấy danh sách học viên đăng ký
router.get('/students', instructorController.getStudents);

// GET /api/instructor/performance - Lấy dữ liệu thống kê hiệu suất học tập/doanh thu
router.get('/performance', instructorController.getPerformance);

// POST /api/instructor/generate-quiz - Sinh câu hỏi trắc nghiệm bằng AI (Gemini)
router.post('/generate-quiz', instructorController.generateQuiz);

module.exports = router;
