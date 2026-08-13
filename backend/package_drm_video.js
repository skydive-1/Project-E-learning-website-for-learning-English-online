/**
 * CLI Tool - Tự động đóng gói Video MP4 sang luồng mã hóa W3C ClearKey DRM (.mpd)
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * 
 * Cú pháp sử dụng:
 * node package_drm_video.js <tên_file_mp4> <lesson_id>
 * Ví dụ:
 * node package_drm_video.js HuyenBe_Grammar14_Les3_Sec1-1783306722938-705588741.mp4 1
 */

const path = require('path');
const fs = require('fs');
const { packageVideoToDrmDash } = require('./src/utils/drmPackager.util');

const fileName = process.argv[2];
const lessonId = process.argv[3] || 1;

if (!fileName) {
  console.log(`
  ❌ THIẾU TÊN FILE VIDEO!
  Cú pháp: node package_drm_video.js <tên_file_video.mp4> [lesson_id]
  `);
  process.exit(1);
}

const videoPath = path.join(__dirname, 'uploads/courses/videos', fileName);

if (!fs.existsSync(videoPath)) {
  console.error(`❌ Không tìm thấy file video tại: ${videoPath}`);
  process.exit(1);
}

console.log(`🚀 Đang tiến hành đóng gói DRM CENC mã hóa W3C ClearKey cho file: ${fileName}...`);

packageVideoToDrmDash(videoPath, lessonId).then((result) => {
  if (result.success) {
    console.log(`
    🎉 HOÀN THÀNH ĐÓNG GÓI DRM VIDEO!
    --------------------------------------------------
    - Lesson ID: ${lessonId}
    - File gốc: ${fileName}
    - URL luồng DRM (.mpd): ${result.mpdUrl}
    --------------------------------------------------
    Bây giờ bạn có thể mở bài học ID ${lessonId} trên web và dùng Extension Screenity để kiểm thử kết quả MÀN HÌNH ĐEN XÌ!
    `);
  } else {
    console.error('❌ Lỗi đóng gói DRM:', result.error);
  }
});
