const path = require('path');

const PUBLIC_VIDEO_ROOT = path.resolve(__dirname, '../../../protected-media/videos');

// Danh sách trắng duy nhất cho mọi video giao diện đi kèm bản build.
// Client chỉ biết assetId; tên và vị trí file thật không xuất hiện trong URL phát.
const PUBLIC_VIDEO_ASSETS = Object.freeze({
  'girl-typing': 'girl_typing.mp4',
  'mascot-idle-light': 'mascot-idle-loop-test-2.mp4',
  'mascot-sleep-dark': 'mascot-warm-night-sleep-test-1.mp4',
  'tired-ai-character': 'tired_ai_character.mp4',
  'tired-ai-character-dark': 'tired_ai_character_dark.mp4',
  'tired-ai-full': 'tired_ai_full.mp4',
  'tired-ai-full-dark': 'tired_ai_full_dark.mp4'
});

function resolvePublicVideoAsset(assetId) {
  const fileName = PUBLIC_VIDEO_ASSETS[String(assetId || '')];
  if (!fileName) return null;

  const filePath = path.resolve(PUBLIC_VIDEO_ROOT, fileName);
  if (path.dirname(filePath) !== PUBLIC_VIDEO_ROOT) return null;
  return { fileName, filePath };
}

module.exports = {
  PUBLIC_VIDEO_ASSETS,
  PUBLIC_VIDEO_ROOT,
  resolvePublicVideoAsset
};
