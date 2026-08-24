/**
 * Consultation Routes - Định nghĩa Endpoint Đăng ký tư vấn
 */

const express = require('express');
const router = express.Router();
const consultationController = require('./consultation.controller');
const { consultationLimiter } = require('../../middleware/rateLimit.middleware');

/**
 * @route   POST /api/consultation/register
 * @desc    Đăng ký nhận tư vấn lộ trình học cá nhân hóa và tự động nhận Gmail
 * @access  Public
 */
router.post('/register', consultationLimiter, consultationController.registerConsultation);

module.exports = router;
