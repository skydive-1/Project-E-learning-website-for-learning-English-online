/**
 * W3C EME ClearKey DRM Utility
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: DRM Security & License Management
 */

const crypto = require('crypto');

/**
 * Chuyển đổi chuỗi Hex (16-byte) sang định dạng Base64URL theo chuẩn W3C RFC 7517 JWK
 * @param {string} hexStr Chuỗi Hex 32 ký tự (16 bytes)
 * @returns {string} Chuỗi Base64URL không chứa padding (=)
 */
function hexToBase64Url(hexStr) {
  if (!hexStr) return '';
  const cleanHex = hexStr.replace(/[^0-9a-fA-F]/g, '');
  const buf = Buffer.from(cleanHex, 'hex');
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Tự động tạo cặp Khóa mã hóa DRM (KID và KEY) ổn định theo Lesson ID
 * @param {number|string} lessonId 
 * @returns {{ keyId: string, secretKey: string, keyIdBase64Url: string, secretKeyBase64Url: string }}
 */
function generateLessonDrmKeys(lessonId) {
  const secretSeed = process.env.JWT_SECRET || 'elearning_drm_secure_jwt_secret_seed';
  
  // Tạo Key ID (KID) 16 bytes (32 ký tự Hex)
  const keyId = crypto
    .createHmac('sha256', secretSeed)
    .update(`lesson_drm_kid_${lessonId}`)
    .digest('hex')
    .substring(0, 32);

  // Tạo Secret Key (KEY) 16 bytes (32 ký tự Hex)
  const secretKey = crypto
    .createHmac('sha256', secretSeed)
    .update(`lesson_drm_key_${lessonId}`)
    .digest('hex')
    .substring(0, 32);

  return {
    keyId,
    secretKey,
    keyIdBase64Url: hexToBase64Url(keyId),
    secretKeyBase64Url: hexToBase64Url(secretKey)
  };
}

/**
 * Đóng gói Payload phản hồi W3C EME ClearKey DRM License (JWK format)
 * @param {Array<{ keyId: string, secretKey: string }>} keyPairs 
 * @returns {object} Phản hồi chuẩn W3C ClearKey DRM
 */
function buildClearKeyJwkResponse(keyPairs) {
  const keys = keyPairs.map(pair => ({
    kty: 'oct',
    kid: hexToBase64Url(pair.keyId),
    k: hexToBase64Url(pair.secretKey)
  }));

  return {
    keys,
    type: 'temporary'
  };
}

module.exports = {
  hexToBase64Url,
  generateLessonDrmKeys,
  buildClearKeyJwkResponse
};
