'use strict';

const { getSubtitles } = require('youtube-caption-extractor');

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_NO_CAPTIONS_MESSAGE =
  'Video YouTube này không có phụ đề công khai. Vui lòng bật auto-caption trên YouTube hoặc tải phụ đề thủ công cho bài học.';

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

function isUnavailableCaptionError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return [
    'no caption',
    'caption fetch failed: 403',
    'caption fetch failed: 404',
    'caption fetch failed: 429',
    'video not playable',
    'video unavailable',
    'private',
    'login_required',
    'sign in to confirm',
    'not a bot',
    'blocked',
    'region'
  ].some(marker => message.includes(marker));
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
    if (isUnavailableCaptionError(error)) {
      throw createYoutubeTranscriptError(
        'YOUTUBE_NO_CAPTIONS_AVAILABLE',
        YOUTUBE_NO_CAPTIONS_MESSAGE,
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
  extractYoutubeVideoId,
  fetchYoutubeTranscript
};
