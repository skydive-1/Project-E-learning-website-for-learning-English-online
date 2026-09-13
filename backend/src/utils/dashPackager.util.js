/**
 * Clear MPEG-DASH packager used for adaptive playback through Shaka Player/MSE.
 *
 * This module deliberately does not configure EME, ClearKey, raw-key encryption,
 * or a license server. Access control is enforced by the protected manifest and
 * segment endpoints instead.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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
    if (fs.existsSync(candidate)) return candidate;
  }

  for (const command of ['shaka-packager', 'packager']) {
    try {
      const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 2000 });
      if (result.status === 0 || String(result.stdout || '').includes('packager')) return command;
    } catch (_) {}
  }

  return null;
}

function checkShakaPackagerInstalled() {
  const executable = findShakaPackagerExecutable();
  if (!executable) return { installed: false, executablePath: null, version: null };

  try {
    const result = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 3000 });
    const output = (result.stdout || result.stderr || '').trim();
    return {
      installed: true,
      executablePath: executable,
      version: output || 'unknown'
    };
  } catch (_) {
    return { installed: false, executablePath: executable, version: null };
  }
}

function buildDashPackagerArgs(inputMp4Path, outputVideoPath, outputAudioPath, outputMpdPath) {
  return [
    `input=${inputMp4Path},stream=video,output=${outputVideoPath}`,
    `input=${inputMp4Path},stream=audio,output=${outputAudioPath}`,
    '--mpd_output', outputMpdPath
  ];
}

function isEncryptedDashManifest(manifest) {
  return /<ContentProtection\b/i.test(String(manifest || ''));
}

/**
 * Package an MP4 as unencrypted MPEG-DASH. Shaka Player will attach the stream
 * to the media element through MediaSource, while the backend protects every
 * manifest and segment request with a short-lived playback ticket.
 */
async function packageVideoToDash(inputMp4Path, assetId) {
  return new Promise((resolve) => {
    if (!fs.existsSync(inputMp4Path)) {
      return resolve({
        success: false,
        error: `File not found: ${inputMp4Path}`,
        isSimulated: false
      });
    }

    const packagerExecutable = findShakaPackagerExecutable();
    if (!packagerExecutable) {
      return resolve({
        success: false,
        error: 'Shaka Packager chưa được cài đặt; không thể tạo luồng DASH thích ứng.',
        isSimulated: false
      });
    }

    const outputDirectory = path.dirname(inputMp4Path);
    const baseName = path.basename(inputMp4Path, path.extname(inputMp4Path));
    const mpdPath = path.join(outputDirectory, `${baseName}_dash.mpd`);
    const videoPath = path.join(outputDirectory, `${baseName}_video.mp4`);
    const audioPath = path.join(outputDirectory, `${baseName}_audio.mp4`);
    const args = buildDashPackagerArgs(inputMp4Path, videoPath, audioPath, mpdPath);

    const child = spawn(packagerExecutable, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.once('error', error => {
      resolve({ success: false, error: error.message, isSimulated: false });
    });

    child.once('close', exitCode => {
      if (exitCode === 0 && fs.existsSync(mpdPath)) {
        console.log(`[DASH Packager] Đóng gói MPEG-DASH không mã hóa thành công cho asset ${assetId}`);
        return resolve({
          success: true,
          mpdPath,
          videoPath,
          audioPath,
          isSimulated: false
        });
      }

      const failureReason = stderr.trim() || `Shaka Packager thoát với mã ${exitCode}`;
      console.error(`[DASH Packager] Không thể đóng gói asset ${assetId}:`, failureReason);
      return resolve({ success: false, error: failureReason, isSimulated: false });
    });
  });
}

module.exports = {
  buildDashPackagerArgs,
  checkShakaPackagerInstalled,
  findShakaPackagerExecutable,
  isEncryptedDashManifest,
  packageVideoToDash
};
