const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  getRequiredPlaybackKeys,
  isAllowedDashPlaybackObject
} = require('../src/utils/mediaAssetGroup.util');
const orphanCleanup = require('../src/utils/orphanCleanup.service');

describe('DASH asset groups', () => {
  test('standard upload requires manifest, video and audio objects', () => {
    assert.deepEqual(
      getRequiredPlaybackKeys('courses/1/asset/manifest.mpd'),
      [
        'courses/1/asset/manifest.mpd',
        'courses/1/asset/video.mp4',
        'courses/1/asset/audio.mp4'
      ]
    );
  });

  test('clear migration requires the objects actually referenced by manifest-clear', () => {
    assert.deepEqual(
      getRequiredPlaybackKeys('courses/1/asset/manifest-clear.mpd'),
      [
        'courses/1/asset/manifest-clear.mpd',
        'courses/1/asset/video-clear.mp4',
        'courses/1/asset/audio-clear.mp4'
      ]
    );
  });

  test('orphan cleanup keeps source and clear DASH siblings together', () => {
    assert.deepEqual(
      orphanCleanup.expandMediaAssets([{
        storage_key: 'courses/1/asset/manifest-clear.mpd',
        storage_bucket: 'elearning-media',
        storage_provider: 'r2'
      }]).map(item => item.key),
      [
        'courses/1/asset/manifest-clear.mpd',
        'courses/1/asset/audio-clear.mp4',
        'courses/1/asset/video-clear.mp4',
        'courses/1/asset/source.mp4'
      ]
    );
  });

  test('DASH endpoint never exposes source.mp4 as a playable segment', () => {
    assert.equal(isAllowedDashPlaybackObject('video.mp4'), true);
    assert.equal(isAllowedDashPlaybackObject('audio-clear.mp4'), true);
    assert.equal(isAllowedDashPlaybackObject('chunk-stream0-00001.m4s'), true);
    assert.equal(isAllowedDashPlaybackObject('source.mp4'), false);
    assert.equal(isAllowedDashPlaybackObject('../source.mp4'), false);
    assert.equal(isAllowedDashPlaybackObject('manifest.mpd'), false);
  });
});
