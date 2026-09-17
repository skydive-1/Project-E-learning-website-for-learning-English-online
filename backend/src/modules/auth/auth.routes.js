/**
 * Auth Routes - Định nghĩa endpoints cho module Auth
 */

const express = require('express');
const router = express.Router();
const authController = require('./controllers/auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validation.middleware');
const upload = require('../../middleware/upload.middleware');
const {
  authLimiter,
  passwordResetLimiter,
  registrationLimiter
} = require('../../middleware/rateLimit.middleware');

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

const verifyEmailSchema = {
  body: {
    token: { required: true, type: 'string', minLength: 64, maxLength: 64 }
  }
};

const resendVerificationSchema = {
  body: {
    email: { required: true, type: 'string', isEmail: true, maxLength: 255 }
  }
};

const requestPasswordOtpSchema = {
  body: {
    oldPassword: { required: true },
    newPassword: { required: true, minLength: 6 }
  }
};

const changePasswordSchema = {
  body: {
    oldPassword: { required: true },
    newPassword: { required: true, minLength: 6 },
    otp: { required: true, minLength: 6, maxLength: 6 }
  }
};

const updateProfileSchema = {
  body: {
    username: { minLength: 3 },
    fullName: { minLength: 2 },
    email: { required: false, isEmail: true },
    profilePictureUrl: { required: false },
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
router.post('/register', registrationLimiter, validate(registerSchema), authController.register);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', registrationLimiter, validate(resendVerificationSchema), authController.resendVerificationEmail);

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
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.post('/change-password/request-otp', authenticate, authLimiter, validate(requestPasswordOtpSchema), authController.requestPasswordChangeOtp);
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.post('/profile/avatar', authenticate, upload.memory.single('avatar'), authController.uploadAvatar);

// Google Sign-In Endpoints
router.post('/google', authLimiter, authController.googleLogin);
router.post('/google/confirm-role', authLimiter, authController.googleConfirmRole);

// Password Reset & OAuth Exchange Endpoints
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);
router.post('/exchange', authLimiter, authController.exchangeToken);

router.get('/stats', authenticate, authController.getUserStats);

module.exports = router;
