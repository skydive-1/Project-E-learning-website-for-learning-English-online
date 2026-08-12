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

// Public or Authenticated DRM License Request Endpoint (Shaka Player / EME standard)
router.options('/license', getClearKeyLicense);
router.options('/license/:lessonId', getClearKeyLicense);
router.post('/license', rawBodyParser, getClearKeyLicense);
router.post('/license/:lessonId', rawBodyParser, getClearKeyLicense);
router.get('/license', getClearKeyLicense);

// Protected DRM Info Endpoint for registered students/instructors
router.options('/info/:lessonId', getClearKeyLicense);
router.get('/info/:lessonId', authenticate, getLessonDrmInfo);

module.exports = router;
