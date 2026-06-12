/**
 * Auth Routes - Định nghĩa endpoints cho module Auth
 */

const express = require('express');
const router = express.Router();
const authController = require('./controllers/auth.controller');
const authMiddleware = require('../../middleware/auth.middleware');
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

// Routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/change-password', authMiddleware, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
