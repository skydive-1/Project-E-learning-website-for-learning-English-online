const crypto = require('crypto');

const VIDEO_TICKET_COOKIE = 'video_playback_ticket';
const PUBLIC_VIDEO_TICKET_COOKIE = 'public_video_playback_ticket';
const DEFAULT_MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const activeTicketRequests = new Map();

function getMaxChunkBytes() {
  const configured = Number.parseInt(process.env.VIDEO_MAX_CHUNK_BYTES, 10);
  return Number.isFinite(configured) && configured >= 256 * 1024
    ? configured
    : DEFAULT_MAX_CHUNK_BYTES;
}

function normalizeOrigin(value) {
  if (!value) return '';
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return '';
  }
}

function getRequestSourceOrigin(req) {
  return normalizeOrigin(req.headers.origin || req.headers.referer || '');
}

function getAllowedFrontendOrigins(env = process.env) {
  const configured = (env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (env.NODE_ENV !== 'production') {
    configured.push('http://localhost:3000', 'http://localhost:5173');
  }

  return new Set(configured);
}

function isAllowedFrontendOrigin(value, env = process.env) {
  const origin = normalizeOrigin(value);
  return Boolean(origin && getAllowedFrontendOrigins(env).has(origin));
}

function isAllowedMediaSource(req) {
  const sourceOrigin = getRequestSourceOrigin(req);
  if (!sourceOrigin) {
    return process.env.NODE_ENV !== 'production' || process.env.VIDEO_REQUIRE_SOURCE_HEADERS === 'false';
  }
  if (isAllowedFrontendOrigin(sourceOrigin)) {
    return true;
  }
  return false;
}

function createClientFingerprint(req) {
  const userAgent = String(req.headers['user-agent'] || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(userAgent).digest('base64url');
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separator = item.indexOf('=');
      if (separator <= 0) return cookies;
      const key = item.slice(0, separator).trim();
      const value = item.slice(separator + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

function getVideoTicketFromRequest(req) {
  const headerTicket = req.headers['x-video-ticket'];
  if (headerTicket) return { token: String(headerTicket), transport: 'header' };

  const cookieTicket = parseCookies(req.headers.cookie)[VIDEO_TICKET_COOKIE];
  if (cookieTicket) return { token: cookieTicket, transport: 'cookie' };

  const queryTicket = req.query.ticket || req.query.token;
  if (queryTicket && process.env.VIDEO_ALLOW_QUERY_TICKET === 'true') {
    return { token: String(queryTicket), transport: 'query' };
  }

  return { token: null, transport: queryTicket ? 'disabled-query' : 'missing' };
}

function getPublicVideoTicketFromRequest(req) {
  const headerTicket = req.headers['x-public-video-ticket'];
  if (headerTicket) return { token: String(headerTicket), transport: 'header' };

  const cookieTicket = parseCookies(req.headers.cookie)[PUBLIC_VIDEO_TICKET_COOKIE];
  if (cookieTicket) return { token: cookieTicket, transport: 'cookie' };

  return { token: null, transport: 'missing' };
}

function setVideoTicketCookie(req, res, ticket, expiresInSeconds) {
  const secure = process.env.NODE_ENV === 'production' || req.secure === true;
  res.cookie(VIDEO_TICKET_COOKIE, ticket, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    partitioned: secure,
    path: '/api/lessons',
    maxAge: expiresInSeconds * 1000
  });
}

function setPublicVideoTicketCookie(req, res, ticket, expiresInSeconds) {
  const secure = process.env.NODE_ENV === 'production' || req.secure === true;
  res.cookie(PUBLIC_VIDEO_TICKET_COOKIE, ticket, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    partitioned: secure,
    path: '/api/media/video',
    maxAge: expiresInSeconds * 1000
  });
}

function isAutomatedDownloader(req) {
  const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
  return [
    'internet download manager',
    ' idm',
    'freedownloadmanager',
    'free download manager',
    'aria2',
    'wget',
    'curl/'
  ].some(marker => userAgent.includes(marker));
}

function registerTicketRequest(req, res, decodedTicket) {
  const requestPath = String(req.path || req.originalUrl || '');
  const isProtectedVideoRequest = requestPath.includes('/video/stream/') || requestPath.includes('/dash/');
  if (!isProtectedVideoRequest) return true;

  const ticketId = decodedTicket.jti;
  if (!ticketId) return true;

  const configured = Number.parseInt(process.env.VIDEO_MAX_PARALLEL_REQUESTS, 10);
  const maxParallel = Number.isFinite(configured) && configured > 0 ? configured : 8;
  const now = Date.now();

  for (const [key, state] of activeTicketRequests) {
    if (state.expiresAt <= now && state.active <= 0) activeTicketRequests.delete(key);
  }

  const state = activeTicketRequests.get(ticketId) || {
    active: 0,
    expiresAt: Number(decodedTicket.exp || 0) * 1000
  };

  if (state.active >= maxParallel) return false;

  state.active += 1;
  activeTicketRequests.set(ticketId, state);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    state.active = Math.max(0, state.active - 1);
    if (state.active === 0 && state.expiresAt <= Date.now()) activeTicketRequests.delete(ticketId);
  };

  res.once('finish', release);
  res.once('close', release);
  return true;
}

function resolveBoundedRange(rangeHeader, fileSize) {
  const maxChunkBytes = getMaxChunkBytes();
  const raw = String(rangeHeader || 'bytes=0-').trim();

  if (raw.includes(',')) return { valid: false, reason: 'MULTI_RANGE_NOT_ALLOWED' };
  const match = /^bytes=(\d+)-(\d*)$/i.exec(raw);
  if (!match) return { valid: false, reason: 'INVALID_RANGE' };

  const start = Number.parseInt(match[1], 10);
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : null;
  if (!Number.isSafeInteger(start) || start < 0) return { valid: false, reason: 'INVALID_RANGE' };
  if (Number.isFinite(fileSize) && fileSize > 0 && start >= fileSize) {
    return { valid: false, reason: 'OUT_OF_RANGE', fileSize };
  }

  const absoluteEnd = Number.isFinite(fileSize) && fileSize > 0 ? fileSize - 1 : Number.MAX_SAFE_INTEGER;
  const boundedEnd = Math.min(
    requestedEnd === null ? absoluteEnd : requestedEnd,
    start + maxChunkBytes - 1,
    absoluteEnd
  );

  if (!Number.isSafeInteger(boundedEnd) || boundedEnd < start) {
    return { valid: false, reason: 'INVALID_RANGE' };
  }

  return {
    valid: true,
    start,
    end: boundedEnd,
    length: boundedEnd - start + 1,
    header: `bytes=${start}-${boundedEnd}`
  };
}

function setProtectedVideoHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'");
  res.setHeader('Content-Disposition', 'inline; filename="lesson-video.mp4"');
}

function isYouTubeUrl(url = '') {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i.test(String(url || ''));
}

function sanitizeLessonMediaForClient(lesson) {
  if (!lesson) return lesson;
  const isYoutube = String(lesson.content_type || '').toLowerCase() === 'youtube' || isYouTubeUrl(lesson.content_url);
  if (isYoutube) return lesson;

  if (String(lesson.content_type).toLowerCase() !== 'video') return lesson;
  const copy = { ...lesson };
  if (/^https?:\/\//i.test(String(copy.content_url || ''))) {
    copy.content_url = 'protected-video-source';
  }
  if (/^https?:\/\//i.test(String(copy.storage_key || ''))) {
    copy.storage_key = null;
  }
  return copy;
}

module.exports = {
  PUBLIC_VIDEO_TICKET_COOKIE,
  VIDEO_TICKET_COOKIE,
  createClientFingerprint,
  getRequestSourceOrigin,
  getPublicVideoTicketFromRequest,
  getVideoTicketFromRequest,
  isAllowedMediaSource,
  isAllowedFrontendOrigin,
  isAutomatedDownloader,
  registerTicketRequest,
  resolveBoundedRange,
  sanitizeLessonMediaForClient,
  setProtectedVideoHeaders,
  setPublicVideoTicketCookie,
  setVideoTicketCookie
};
