/**
 * Auth Module - Xác thực người dùng
 * - Login
 * - Register
 * - JWT verification
 */

const express = require('express');
const router = express.Router();
const authController = require('./controllers/auth.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
