/**
 * Courses Routes - Định nghĩa endpoints cho Module Courses
 */

const express = require('express');
const router = express.Router();
const coursesController = require('./controllers/courses.controller');

// GET /api/courses
router.get('/', coursesController.getAllCourses);

module.exports = router;
