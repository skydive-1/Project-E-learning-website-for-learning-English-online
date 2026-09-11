'use strict';

const { getSubtitles } = require('youtube-caption-extractor');

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_NO_CAPTIONS_MESSAGE =
  'Video YouTube này không có phụ đề công khai. Vui lòng bật auto-caption trên YouTube hoặc tải phụ đề thủ công cho bài học.';
const YOUTUBE_TRANSCRIPT_RATE_LIMIT_MESSAGE =
  'YouTube đang giới hạn tạm thời yêu cầu lấy phụ đề. Hệ thống không kết luận video thiếu phụ đề; vui lòng thử lại sau.';
const YOUTUBE_TRANSCRIPT_ACCESS_BLOCKED_MESSAGE =
  'YouTube tạm thời từ chối máy chủ lấy phụ đề công khai. Video vẫn có thể phát; vui lòng thử tạo phụ đề lại sau.';
const YOUTUBE_VIDEO_UNAVAILABLE_MESSAGE =
  'Video YouTube không khả dụng công khai, bị giới hạn khu vực hoặc yêu cầu đăng nhập. Vui lòng kiểm tra quyền xem video.';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be'
]);

function createYoutubeTranscriptError(code, message, status, cause) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}

function extractYoutubeVideoId(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const rawValue = value.trim();
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch (_) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname)) return null;

  let candidate = null;
  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] || null;
  } else if (parsed.pathname === '/watch') {
    candidate = parsed.searchParams.get('v');
  } else {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'live', 'v', 'e'].includes(parts[0])) candidate = parts[1] || null;
  }

  return YOUTUBE_VIDEO_ID_PATTERN.test(candidate || '') ? candidate : null;
}

function normalizeYoutubeUrl(value) {
  const videoId = extractYoutubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
}

function classifyYoutubeTranscriptError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (/\b429\b|too many requests|rate.?limit/.test(message)) return 'rate_limited';
  if (/\b403\b|sign in to confirm|not a bot|bot check|blocked|forbidden/.test(message)) return 'access_blocked';
  if (/\b404\b|video not playable|video unavailable|private|login_required|region|members-only|age.?restricted/.test(message)) {
    return 'video_unavailable';
  }
  if (/no caption|no subtitle|no caption tracks? available/.test(message)) return 'no_captions';
  return 'unknown';
}

async function fetchYoutubeTranscript(videoId) {
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(String(videoId || ''))) {
    throw createYoutubeTranscriptError(
      'YOUTUBE_INVALID_VIDEO_ID',
      'ID video YouTube không hợp lệ.',
      400
    );
  }

  try {
    const transcript = await getSubtitles({ videoID: videoId, lang: 'en' });
    const segments = (Array.isArray(transcript) ? transcript : [])
      .map(segment => ({
        start: Number(segment?.start),
        duration: Number(segment?.dur),
        text: String(segment?.text || '').trim()
      }))
      .filter(segment => (
        Number.isFinite(segment.start) &&
        segment.start >= 0 &&
        Number.isFinite(segment.duration) &&
        segment.duration >= 0 &&
        segment.text.length > 0
      ));

    if (segments.length === 0) {
      throw createYoutubeTranscriptError(
        'YOUTUBE_NO_CAPTIONS_AVAILABLE',
        YOUTUBE_NO_CAPTIONS_MESSAGE,
        422
      );
    }

    return segments;
  } catch (error) {
    if (error?.code === 'YOUTUBE_NO_CAPTIONS_AVAILABLE') throw error;
    const classification = classifyYoutubeTranscriptError(error);
    if (classification === 'no_captions') {
      throw createYoutubeTranscriptError(
        'YOUTUBE_NO_CAPTIONS_AVAILABLE',
        YOUTUBE_NO_CAPTIONS_MESSAGE,
        422,
        error
      );
    }
    if (classification === 'rate_limited') {
      throw createYoutubeTranscriptError(
        'YOUTUBE_TRANSCRIPT_RATE_LIMITED',
        YOUTUBE_TRANSCRIPT_RATE_LIMIT_MESSAGE,
        503,
        error
      );
    }
    if (classification === 'access_blocked') {
      throw createYoutubeTranscriptError(
        'YOUTUBE_TRANSCRIPT_ACCESS_BLOCKED',
        YOUTUBE_TRANSCRIPT_ACCESS_BLOCKED_MESSAGE,
        503,
        error
      );
    }
    if (classification === 'video_unavailable') {
      throw createYoutubeTranscriptError(
        'YOUTUBE_VIDEO_UNAVAILABLE',
        YOUTUBE_VIDEO_UNAVAILABLE_MESSAGE,
        422,
        error
      );
    }
    throw createYoutubeTranscriptError(
      'YOUTUBE_TRANSCRIPT_FETCH_FAILED',
      'Không thể lấy phụ đề công khai từ YouTube lúc này. Vui lòng thử lại sau.',
      502,
      error
    );
  }
}

module.exports = {
  YOUTUBE_NO_CAPTIONS_MESSAGE,
  YOUTUBE_TRANSCRIPT_RATE_LIMIT_MESSAGE,
  YOUTUBE_TRANSCRIPT_ACCESS_BLOCKED_MESSAGE,
  YOUTUBE_VIDEO_UNAVAILABLE_MESSAGE,
  extractYoutubeVideoId,
  normalizeYoutubeUrl,
  fetchYoutubeTranscript,
  classifyYoutubeTranscriptError
};
