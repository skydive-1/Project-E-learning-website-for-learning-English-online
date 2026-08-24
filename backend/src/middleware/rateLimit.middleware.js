const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const readPositiveInteger = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

// Rate limiting may only be disabled explicitly outside production. This keeps a
// forgotten development flag from disabling protection in a deployed system.
const isRateLimitDisabled = () => (
  process.env.NODE_ENV !== 'production'
  && String(process.env.DISABLE_RATE_LIMIT).toLowerCase() === 'true'
);

const isStreamingRequest = (req) => (
  /^\/api\/lessons\/(?:dash\/|video\/stream\/)/.test(req.originalUrl || req.url)
);

const clientKey = (req) => `ip:${ipKeyGenerator(req.ip)}`;

const authenticatedUserKey = (req) => {
  const userId = req.user?.id || req.user?.user_id;
  return userId ? `user:${userId}` : clientKey(req);
};

const createRateLimiter = ({
  name,
  windowMs,
  limit,
  keyGenerator,
  skip,
  skipSuccessfulRequests = false
}) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  passOnStoreError: false,
  skipSuccessfulRequests,
  keyGenerator,
  skip: (req, res) => isRateLimitDisabled() || Boolean(skip?.(req, res)),
  identifier: name,
  handler: (req, res, next, options) => res.status(options.statusCode).json({
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
    retryAfter: res.getHeader('Retry-After') || null
  })
});

// Broad protection for every HTTP endpoint, including health checks, Swagger
// and static uploads. The high ceiling avoids interrupting legitimate media use.
const globalLimiter = createRateLimiter({
  name: 'global',
  windowMs: readPositiveInteger('RATE_LIMIT_GLOBAL_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_GLOBAL_MAX', 3000),
  keyGenerator: clientKey
});

// Applies to every /api route. Streaming is handled by streamingLimiter below
// because DASH players legitimately request many small segments.
const apiLimiter = createRateLimiter({
  name: 'api',
  windowMs: readPositiveInteger('RATE_LIMIT_API_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_API_MAX', 300),
  keyGenerator: clientKey,
  skip: isStreamingRequest
});

const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: readPositiveInteger('RATE_LIMIT_AUTH_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_AUTH_MAX', 10),
  keyGenerator: clientKey,
  skipSuccessfulRequests: true
});

const registrationLimiter = createRateLimiter({
  name: 'registration',
  windowMs: readPositiveInteger('RATE_LIMIT_REGISTRATION_WINDOW_MS', ONE_HOUR),
  limit: readPositiveInteger('RATE_LIMIT_REGISTRATION_MAX', 5),
  keyGenerator: clientKey
});

const passwordResetLimiter = createRateLimiter({
  name: 'password-reset',
  windowMs: readPositiveInteger('RATE_LIMIT_PASSWORD_WINDOW_MS', ONE_HOUR),
  limit: readPositiveInteger('RATE_LIMIT_PASSWORD_MAX', 5),
  keyGenerator: clientKey
});

const aiLimiter = createRateLimiter({
  name: 'ai',
  windowMs: readPositiveInteger('RATE_LIMIT_AI_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_AI_MAX', 30),
  keyGenerator: authenticatedUserKey
});

const quizLimiter = createRateLimiter({
  name: 'quiz',
  windowMs: readPositiveInteger('RATE_LIMIT_QUIZ_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_QUIZ_MAX', 30),
  keyGenerator: authenticatedUserKey
});

const uploadLimiter = createRateLimiter({
  name: 'upload',
  windowMs: readPositiveInteger('RATE_LIMIT_UPLOAD_WINDOW_MS', ONE_HOUR),
  limit: readPositiveInteger('RATE_LIMIT_UPLOAD_MAX', 30),
  keyGenerator: authenticatedUserKey
});

const consultationLimiter = createRateLimiter({
  name: 'consultation',
  windowMs: readPositiveInteger('RATE_LIMIT_CONSULTATION_WINDOW_MS', ONE_HOUR),
  limit: readPositiveInteger('RATE_LIMIT_CONSULTATION_MAX', 5),
  keyGenerator: clientKey
});

const mediaTicketLimiter = createRateLimiter({
  name: 'media-ticket',
  windowMs: readPositiveInteger('RATE_LIMIT_MEDIA_TICKET_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_MEDIA_TICKET_MAX', 120),
  keyGenerator: authenticatedUserKey
});

const streamingLimiter = createRateLimiter({
  name: 'media-stream',
  windowMs: readPositiveInteger('RATE_LIMIT_STREAM_WINDOW_MS', FIFTEEN_MINUTES),
  limit: readPositiveInteger('RATE_LIMIT_STREAM_MAX', 2000),
  keyGenerator: clientKey
});

const configureTrustProxy = (app) => {
  const rawValue = process.env.TRUST_PROXY;
  if (rawValue === undefined || rawValue === '') return;

  if (rawValue === 'true' || rawValue === 'false') {
    app.set('trust proxy', rawValue === 'true');
    return;
  }

  const hopCount = Number.parseInt(rawValue, 10);
  app.set('trust proxy', Number.isSafeInteger(hopCount) && hopCount >= 0 ? hopCount : rawValue);
};

module.exports = {
  aiLimiter,
  apiLimiter,
  authLimiter,
  configureTrustProxy,
  consultationLimiter,
  createRateLimiter,
  globalLimiter,
  mediaTicketLimiter,
  passwordResetLimiter,
  quizLimiter,
  registrationLimiter,
  streamingLimiter,
  uploadLimiter
};
