/**
 * Auth Routes - Định nghĩa endpoints cho module Auth
 */

const express = require('express');
const router = express.Router();
const authController = require('./controllers/auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validation.middleware');

// Schemas Validation
const registerSchema = {
  body: {
    email: { required: true, isEmail: true },
    password: { required: true, minLength: 6 },
    username: { required: true, minLength: 3 },
    fullName: { required: false }
  }
};

const loginSchema = {
  body: {
    email: { required: true, isEmail: true },
    password: { required: true }
  }
};

const changePasswordSchema = {
  body: {
    oldPassword: { required: true },
    newPassword: { required: true, minLength: 6 }
  }
};

const updateProfileSchema = {
  body: {
    username: { minLength: 3 },
    fullName: { minLength: 2 },
    phone: { required: false },
    gender: { required: false },
    birthDate: { required: false }
  }
};

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API cho xác thực và quản lý tài khoản
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 */
// Routes
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công và trả về token
 */
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);

// Google Sign-In Endpoints
router.post('/google', authController.googleLogin);
router.post('/google/confirm-role', authController.googleConfirmRole);

module.exports = router;
