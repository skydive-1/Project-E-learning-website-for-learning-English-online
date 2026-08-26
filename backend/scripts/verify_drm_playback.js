/**
 * End-to-end DRM playback smoke test against a running backend.
 * Usage: node scripts/verify_drm_playback.js <lessonId> [userId]
 */
const jwt = require('jsonwebtoken');
const db = require('../src/config/database');

async function main() {
  const lessonId = Number.parseInt(process.argv[2], 10);
  const userId = Number.parseInt(process.argv[3] || '18', 10);
  const baseUrl = process.env.DRM_SMOKE_BASE_URL || 'http://127.0.0.1:5000';
  const frontendOrigin = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3001';
  if (!lessonId || !userId || !process.env.JWT_SECRET) {
    throw new Error('Thiếu lessonId, userId hoặc JWT_SECRET');
  }

  const user = (await db.query(
    'SELECT user_id, email, role_id FROM users WHERE user_id = $1',
    [userId]
  )).rows[0];
  if (!user) throw new Error(`Không tìm thấy user ${userId}`);

  const session = jwt.sign(
    { id: user.user_id, email: user.email, roleId: user.role_id },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  const sessionHeaders = {
    Authorization: `Bearer ${session}`,
    Origin: frontendOrigin
  };

  const ticketResponse = await fetch(`${baseUrl}/api/lessons/video/ticket/${lessonId}`, {
    headers: sessionHeaders
  });
  const ticketPayload = await ticketResponse.json();
  if (!ticketResponse.ok || !ticketPayload.ticket) {
    throw new Error(`Ticket thất bại (${ticketResponse.status}): ${ticketPayload.message || 'unknown'}`);
  }

  const mediaHeaders = {
    Origin: frontendOrigin,
    'X-Video-Ticket': ticketPayload.ticket
  };
  const manifestResponse = await fetch(
    `${baseUrl}/api/lessons/dash/${lessonId}/manifest.mpd`,
    { headers: mediaHeaders }
  );
  const manifest = await manifestResponse.text();
  const segmentFile = manifest.match(/<BaseURL>\s*([^<]+?)\s*<\/BaseURL>/i)?.[1];
  const kidHex = manifest.match(/default_KID="([^"]+)"/i)?.[1]?.replace(/-/g, '');
  if (!manifestResponse.ok || !segmentFile || !kidHex) {
    throw new Error(`Manifest DRM không hợp lệ (${manifestResponse.status})`);
  }

  const segmentResponse = await fetch(
    `${baseUrl}/api/lessons/dash/${lessonId}/${encodeURIComponent(segmentFile)}`,
    { headers: { ...mediaHeaders, Range: 'bytes=0-1192' } }
  );
  await segmentResponse.body?.cancel();

  const kid = Buffer.from(kidHex, 'hex').toString('base64url');
  const licenseResponse = await fetch(`${baseUrl}/api/drm/license/${lessonId}`, {
    method: 'POST',
    headers: { ...sessionHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kids: [kid], type: 'temporary' })
  });
  const licensePayload = await licenseResponse.json();

  const result = {
    lessonId,
    ticketStatus: ticketResponse.status,
    querylessStreamUrl: !ticketPayload.streamUrl.includes('?'),
    manifestStatus: manifestResponse.status,
    manifestType: manifestResponse.headers.get('content-type'),
    encrypted: manifest.includes('ContentProtection') && manifest.includes('cenc:default_KID'),
    segmentStatus: segmentResponse.status,
    segmentRange: segmentResponse.headers.get('content-range'),
    licenseStatus: licenseResponse.status,
    licenseNoStore: /no-store/.test(licenseResponse.headers.get('cache-control') || ''),
    licenseKeyCount: Array.isArray(licensePayload.keys) ? licensePayload.keys.length : 0
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.encrypted || result.segmentStatus !== 206 || result.licenseStatus !== 200) {
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
