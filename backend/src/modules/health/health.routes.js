/**
 * Health Probes Routes
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const express = require('express');
const router = express.Router();
const { getLive, getReady, getLegacyHealth } = require('./health.controller');

// Kubernetes / Docker probes
router.get('/live', getLive);
router.get('/ready', getReady);

// Backward compatibility
router.get('/', getLegacyHealth);

module.exports = router;
