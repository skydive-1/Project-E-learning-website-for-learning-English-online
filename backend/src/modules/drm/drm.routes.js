/**
 * DRM Routes - W3C EME ClearKey License Endpoints
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: DRM Security & License Management
 */

const express = require('express');
const router = express.Router();
const { getClearKeyLicense, getLessonDrmInfo } = require('./drm.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Supporting raw payload parser for W3C EME binary/buffer request bodies
const rawBodyParser = express.raw({ type: '*/*', limit: '2mb' });

// Authenticated DRM License Request Endpoints (Shaka Player / W3C EME standard)
router.options('/license', getClearKeyLicense);
router.options('/license/:lessonId', getClearKeyLicense);
router.post('/license', authenticate, rawBodyParser, getClearKeyLicense);
router.post('/license/:lessonId', authenticate, rawBodyParser, getClearKeyLicense);
router.get('/license', authenticate, getClearKeyLicense);
router.get('/license/:lessonId', authenticate, getClearKeyLicense);

// Protected DRM Info Endpoint for registered students/instructors
router.options('/info/:lessonId', getClearKeyLicense);
router.get('/info/:lessonId', authenticate, getLessonDrmInfo);

module.exports = router;
