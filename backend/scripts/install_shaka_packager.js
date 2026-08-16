/**
 * Script tự động tải Shaka Packager binary phù hợp với hệ điều hành khi deploy (Railway, Render, VPS, Local)
 * Tự động chạy trong quá trình `npm install` hoặc `postinstall`.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '../bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const isLinux = process.platform === 'linux';
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

let targetFileName = '';
let downloadUrl = '';

if (isLinux) {
  targetFileName = 'packager-linux-x64';
  downloadUrl = 'https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-linux-x64';
} else if (isWin) {
  targetFileName = 'packager-win-x64.exe';
  downloadUrl = 'https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-win-x64.exe';
} else if (isMac) {
  targetFileName = 'packager-osx-x64';
  downloadUrl = 'https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-osx-x64';
}

const targetPath = path.join(binDir, targetFileName);

// Kiểm tra xem binary đã tồn tại chưa
if (fs.existsSync(targetPath)) {
  console.log(`[Shaka Installer] ✅ Binary '${targetFileName}' đã sẵn sàng tại: ${targetPath}`);
  process.exit(0);
}

// Kiểm tra xem shaka-packager.exe / shaka-packager đã tồn tại chưa
const altPath = path.join(binDir, isWin ? 'shaka-packager.exe' : 'shaka-packager');
if (fs.existsSync(altPath)) {
  console.log(`[Shaka Installer] ✅ Binary '${path.basename(altPath)}' đã sẵn sàng.`);
  process.exit(0);
}

if (!downloadUrl) {
  console.log(`[Shaka Installer] ⏩ Nền tảng ${process.platform} không hỗ trợ tải tự động.`);
  process.exit(0);
}

console.log(`[Shaka Installer] ⬇️ Đang tự động tải Shaka Packager (${targetFileName}) cho ${process.platform}...`);

function downloadFile(url, dest, callback) {
  const file = fs.createWriteStream(dest);
  https.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
      // Chuyển hướng URL (Redirect)
      return downloadFile(response.headers.location, dest, callback);
    }
    if (response.statusCode !== 200) {
      console.warn(`[Shaka Installer] ⚠️ Lỗi tải file: HTTP ${response.statusCode}`);
      fs.unlink(dest, () => {});
      return callback(new Error(`HTTP ${response.statusCode}`));
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close(() => callback(null));
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    callback(err);
  });
}

downloadFile(downloadUrl, targetPath, (err) => {
  if (err) {
    console.warn(`[Shaka Installer] ⚠️ Không thể tải Shaka Packager tự động: ${err.message}`);
    // Không làm lỗi build deploy
    process.exit(0);
  }
  
  if (isLinux || isMac) {
    try {
      execSync(`chmod +x "${targetPath}"`);
    } catch (_) {}
  }
  console.log(`[Shaka Installer] 🎉 Đã cài đặt Shaka Packager thành công tại: ${targetPath}`);
  process.exit(0);
});
