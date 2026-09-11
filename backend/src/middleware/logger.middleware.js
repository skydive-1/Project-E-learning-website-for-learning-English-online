const { randomUUID } = require('crypto');
const { logger } = require('../config/logger');

const loggerMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const incomingRequestId = req.get('x-request-id');
  const requestId = incomingRequestId && incomingRequestId.length <= 128
    ? incomingRequestId
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const logData = {
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      userId: req.user?.id || req.user?.userId || null
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'HTTP Request Server Error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'HTTP Request Client Error');
    } else {
      logger.info(logData, 'HTTP Request Completed');
    }
  });

  next();
};

module.exports = loggerMiddleware;
