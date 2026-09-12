'use strict';

const path = require('path');

const isDashManifest = storageKey => String(storageKey || '').toLowerCase().endsWith('/manifest.mpd');

const getRequiredPlaybackKeys = (storageKey) => {
  const key = String(storageKey || '');
  if (!isDashManifest(key)) return key ? [key] : [];
  const prefix = path.posix.dirname(key);
  return [
    key,
    path.posix.join(prefix, 'video.mp4'),
    path.posix.join(prefix, 'audio.mp4')
  ];
};

module.exports = {
  isDashManifest,
  getRequiredPlaybackKeys
};
