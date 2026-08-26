/**
 * DRM Video Transcoder & DASH CENC Packager Utility
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: DRM Security & Video Transcoding Engine
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { generateLessonDrmKeys } = require('./drm.util');

/**
 * Tìm đường dẫn thực thi của Shaka Packager binary trên máy chủ
 * @returns {string|null} Đường dẫn binary hoặc tên lệnh nếu khả dụng trong PATH
 */
function findShakaPackagerExecutable() {
  if (process.env.SHAKA_PACKAGER_PATH && fs.existsSync(process.env.SHAKA_PACKAGER_PATH)) {
    return process.env.SHAKA_PACKAGER_PATH;
  }

  const localCandidates = process.platform === 'win32'
    ? [
        path.resolve(__dirname, '../../bin/packager-win-x64.exe'),
        path.resolve(__dirname, '../../bin/shaka-packager.exe'),
        path.resolve(__dirname, '../../../bin/packager-win-x64.exe'),
        path.resolve(__dirname, '../../../bin/shaka-packager.exe')
      ]
    : [
        path.resolve(__dirname, '../../bin/packager-linux-x64'),
        path.resolve(__dirname, '../../bin/shaka-packager'),
        path.resolve(__dirname, '../../../bin/packager-linux-x64'),
        path.resolve(__dirname, '../../../bin/shaka-packager')
      ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Thử kiểm tra trong PATH hệ thống (shaka-packager hoặc packager)
  const commands = ['shaka-packager', 'packager'];
  for (const cmd of commands) {
    try {
      const res = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 2000 });
      if (res.status === 0 || (res.stdout && res.stdout.includes('packager'))) {
        return cmd;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Kiểm tra xem Shaka Packager đã được cài đặt và hoạt động được hay chưa
 * @returns {{ installed: boolean, executablePath: string|null, version: string|null }}
 */
function checkShakaPackagerInstalled() {
  const executable = findShakaPackagerExecutable();
  if (!executable) {
    return { installed: false, executablePath: null, version: null };
  }

  try {
    const res = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 3000 });
    const output = (res.stdout || res.stderr || '').trim();
    return {
      installed: true,
      executablePath: executable,
      version: output || 'unknown'
    };
  } catch (err) {
    return { installed: false, executablePath: executable, version: null };
  }
}

/**
 * Đóng gói file MP4 sang chuẩn MPEG-DASH CENC Encrypted (.mpd) cho W3C ClearKey DRM
 * @param {string} inputMp4Path Đường dẫn tuyệt đối đến file MP4 gốc
 * @param {number|string} lessonId ID bài học
 * @returns {Promise<{ success: boolean, mpdUrl?: string, mpdPath?: string, encryptedVideoPath?: string, encryptedAudioPath?: string, error?: string, isSimulated: boolean }>}
 */
async function packageVideoToDrmDash(inputMp4Path, lessonId) {
  return new Promise((resolve) => {
    if (!fs.existsSync(inputMp4Path)) {
      console.error(`❌ [DRM Packager Error]: Không tìm thấy file MP4 tại ${inputMp4Path}`);
      return resolve({ success: false, error: `File not found: ${inputMp4Path}`, isSimulated: false });
    }

    const packagerBin = findShakaPackagerExecutable();
    if (!packagerBin) {
      const errorMsg = 'Shaka Packager binary chưa được cài đặt trên máy chủ. Video sẽ được lưu ở định dạng MP4 gốc không mã hóa.';
      console.warn(`⚠️ [DRM Packager]: ${errorMsg}`);
      return resolve({
        success: false,
        error: errorMsg,
        isSimulated: false
      });
    }

    const { keyId, secretKey } = generateLessonDrmKeys(lessonId);
    const videoDir = path.dirname(inputMp4Path);
    const baseName = path.basename(inputMp4Path, path.extname(inputMp4Path));
    const outputMpdPath = path.join(videoDir, `${baseName}_drm.mpd`);
    const outputVideoPath = path.join(videoDir, `${baseName}_enc_video.mp4`);
    const outputAudioPath = path.join(videoDir, `${baseName}_enc_audio.mp4`);

    // Truyền argument trực tiếp, không ghép shell command. Cách này hoạt động
    // nhất quán trên Windows/Linux và tránh lỗi escape hoặc command injection.
    const packagerArgs = [
      `input=${inputMp4Path},stream=video,output=${outputVideoPath}`,
      `input=${inputMp4Path},stream=audio,output=${outputAudioPath}`,
      '--enable_raw_key_encryption',
      '--keys', `label=:key_id=${keyId}:key=${secretKey}`,
      '--mpd_output', outputMpdPath
    ];
    const child = spawn(packagerBin, packagerArgs, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.once('error', (error) => {
      return resolve({ success: false, error: error.message, isSimulated: false });
    });

    child.once('close', (exitCode) => {
      if (exitCode === 0 && fs.existsSync(outputMpdPath)) {
        console.log(`✅ [DRM Packager]: Đóng gói DRM MPEG-DASH thành công cho Lesson ${lessonId}`);
        const normalizedPath = outputMpdPath.replace(/\\/g, '/');
        const uploadsIndex = normalizedPath.lastIndexOf('/uploads/');
        const relativeUrl = uploadsIndex >= 0
          ? normalizedPath.slice(uploadsIndex)
          : normalizedPath;

        return resolve({
          success: true,
          mpdPath: outputMpdPath,
          mpdUrl: relativeUrl,
          encryptedVideoPath: outputVideoPath,
          encryptedAudioPath: outputAudioPath,
          isSimulated: false
        });
      }

      const failureReason = stderr.trim() || `Shaka Packager thoát với mã ${exitCode}`;
      console.error(`❌ [DRM Packager Failed]: Lỗi đóng gói DRM cho Lesson ${lessonId}:`, failureReason);

      return resolve({
        success: false,
        error: failureReason,
        isSimulated: false
      });
    });
  });
}

module.exports = {
  packageVideoToDrmDash,
  checkShakaPackagerInstalled,
  findShakaPackagerExecutable
};
