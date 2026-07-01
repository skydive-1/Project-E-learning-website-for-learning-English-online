const express = require('express');
const router = express.Router();
const quizzesController = require('./controllers/quizzes.controller');

// Route: GET /api/quizzes/:courseId
router.get('/:courseId', quizzesController.getQuizzes);

// Route: POST /api/quizzes/submit
router.post('/submit', quizzesController.submitQuiz);

module.exports = router;
