/**
 * Read-only compatibility helpers for subtitle extraction from legacy encrypted
 * assets. New uploads and browser playback must not import this module.
 */

const crypto = require('crypto');

function generateLegacyMediaKeys(reference) {
  const secretSeed = process.env.JWT_SECRET || 'elearning_drm_secure_jwt_secret_seed';
  const normalizedReference = String(reference);
  const keyId = crypto
    .createHmac('sha256', secretSeed)
    .update(`lesson_drm_kid_${normalizedReference}`)
    .digest('hex')
    .slice(0, 32);
  const secretKey = crypto
    .createHmac('sha256', secretSeed)
    .update(`lesson_drm_key_${normalizedReference}`)
    .digest('hex')
    .slice(0, 32);

  return { keyId, secretKey };
}

function getLegacyMediaKeyReference(lesson, fallbackLessonId) {
  if (lesson?.drm_key_ref) return lesson.drm_key_ref;
  const source = lesson?.storage_key || lesson?.content_url || '';
  const assetId = String(source).match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i)?.[1];
  return assetId || fallbackLessonId;
}

module.exports = {
  generateLegacyMediaKeys,
  getLegacyMediaKeyReference
};
