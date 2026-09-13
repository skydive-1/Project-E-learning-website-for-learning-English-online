'use strict';

const path = require('path');

const isDashManifest = storageKey => /\.mpd$/i.test(String(storageKey || ''));

const isAllowedDashPlaybackObject = fileName => (
  /^(?:video|audio)(?:-clear)?\.mp4$/i.test(String(fileName || ''))
  || /^[A-Za-z0-9_.-]+\.m4s$/i.test(String(fileName || ''))
);

const getRequiredPlaybackKeys = (storageKey) => {
  const key = String(storageKey || '');
  if (!isDashManifest(key)) return key ? [key] : [];
  const prefix = path.posix.dirname(key);
  const clearMigrationBundle = path.posix.basename(key).toLowerCase() === 'manifest-clear.mpd';
  return [
    key,
    path.posix.join(prefix, clearMigrationBundle ? 'video-clear.mp4' : 'video.mp4'),
    path.posix.join(prefix, clearMigrationBundle ? 'audio-clear.mp4' : 'audio.mp4')
  ];
};

module.exports = {
  isDashManifest,
  isAllowedDashPlaybackObject,
  getRequiredPlaybackKeys
};
