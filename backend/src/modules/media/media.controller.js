const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const {
  createClientFingerprint,
  getRequestSourceOrigin,
  isAllowedMediaSource,
  isAutomatedDownloader,
  resolveBoundedRange,
  setProtectedVideoHeaders,
  setPublicVideoTicketCookie
} = require('../../utils/videoSecurity.util');
const { resolvePublicVideoAsset } = require('./publicVideoAssets');

function sendRangeNotSatisfiable(res, fileSize) {
  res.setHeader('Content-Range', `bytes */${fileSize}`);
  return res.status(416).end();
}

exports.getPublicVideoTicket = (req, res, next) => {
  try {
    if (isAutomatedDownloader(req)) {
      return res.status(403).json({
        success: false,
        code: 'DOWNLOAD_MANAGER_BLOCKED',
        message: 'Automated download managers are prohibited.'
      });
    }

    if (!isAllowedMediaSource(req)) {
      return res.status(403).json({
        success: false,
        code: 'HOTLINK_BLOCKED',
        message: 'Nguồn yêu cầu không thuộc frontend đã cấu hình.'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        message: 'JWT_SECRET chưa được cấu hình trên hệ thống'
      });
    }

    const expiresIn = Number.parseInt(process.env.VIDEO_TICKET_TTL_SECONDS, 10) || 60;
    const ticket = jwt.sign(
      {
        origin: getRequestSourceOrigin(req),
        clientHash: createClientFingerprint(req),
        type: 'public_video_stream_ticket'
      },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn,
        jwtid: crypto.randomUUID(),
        issuer: 'elearning-api',
        audience: 'public-video-stream'
      }
    );

    setPublicVideoTicketCookie(req, res, ticket, expiresIn);
    return res.status(200).json({ success: true, expiresIn });
  } catch (error) {
    return next(error);
  }
};

exports.streamPublicVideo = (req, res, next) => {
  try {
    const asset = resolvePublicVideoAsset(req.params.assetId);
    if (!asset || !fs.existsSync(asset.filePath)) {
      return res.status(404).json({
        success: false,
        code: 'VIDEO_NOT_FOUND',
        message: 'Video không tồn tại.'
      });
    }

    const fileSize = fs.statSync(asset.filePath).size;
    const boundedRange = resolveBoundedRange(req.headers.range, fileSize);
    if (!boundedRange.valid) return sendRangeNotSatisfiable(res, fileSize);

    setProtectedVideoHeaders(res);
    res.writeHead(206, {
      'Content-Range': `bytes ${boundedRange.start}-${boundedRange.end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': boundedRange.length,
      'Content-Type': 'video/mp4',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="protected-video.mp4"',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0'
    });

    const file = fs.createReadStream(asset.filePath, {
      start: boundedRange.start,
      end: boundedRange.end
    });
    file.once('error', next);
    return file.pipe(res);
  } catch (error) {
    return next(error);
  }
};
