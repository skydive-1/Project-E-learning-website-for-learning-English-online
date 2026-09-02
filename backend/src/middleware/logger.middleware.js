const { randomUUID } = require('crypto');

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
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      userId: req.user?.id || req.user?.userId || null,
      timestamp: new Date().toISOString()
    }));
  });

  next();
};

module.exports = loggerMiddleware;
