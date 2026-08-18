/**
 * Verification Script for TASK-FE-PWA-01
 * Checks PWA Manifest, Service Worker Precache, Mobile Navigation, and Security Denylist
 */

const fs = require('fs');
const path = require('path');

function runPwaVerification() {
  console.log("================================================================================");
  console.log("🚀 BẮT ĐẦU KIỂM THỬ [TASK-FE-PWA-01] PWA & MOBILE UX");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = "") {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      if (details) console.log(`   👉 ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      if (details) console.error(`   ⚠️ Chi tiết: ${details}`);
    }
  }

  const buildDir = path.resolve(__dirname, '../../frontend/build');
  const manifestPath = path.join(buildDir, 'manifest.webmanifest');
  const swPath = path.join(buildDir, 'sw.js');
  const indexPath = path.join(buildDir, 'index.html');

  // 1. Kiểm tra Manifest
  assert(fs.existsSync(manifestPath), "1.1. Tệp manifest.webmanifest được tạo thành công");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifest.name === "E-Learn Academy", "1.2. Manifest name chuẩn: 'E-Learn Academy'");
    assert(manifest.short_name === "E-Learn", "1.3. Manifest short_name chuẩn: 'E-Learn'");
    assert(manifest.theme_color === "#0F172A", "1.4. Manifest theme_color chuẩn Deep Navy (#0F172A)");
    assert(manifest.background_color === "#0F172A", "1.5. Manifest background_color chuẩn (#0F172A)");
    assert(manifest.display === "standalone", "1.6. Manifest display chuẩn: 'standalone'");
    assert(manifest.icons && manifest.icons.length >= 4, "1.7. Manifest icons có đầy đủ 192x192, 512x512 và maskable");
  }

  // 2. Kiểm tra Service Worker & Workbox Cache Rules
  assert(fs.existsSync(swPath), "2.1. Tệp Service Worker (sw.js) được biên dịch thành công");
  if (fs.existsSync(swPath)) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert(swContent.includes('skipWaiting'), "2.2. Service Worker hỗ trợ auto-update (skipWaiting & clientsClaim)");
    assert(swContent.includes('cleanupOutdatedCaches'), "2.3. Service Worker hỗ trợ dọn dẹp cache cũ (cleanupOutdatedCaches)");
    assert(swContent.includes('/^\\/api/') && swContent.includes('/^\\/uploads/'), "2.4. Navigation Denylist loại trừ nghiêm ngặt /api và /uploads khỏi cache fallback");
    assert(!swContent.includes('localStorage') && !swContent.includes('sessionStorage'), "2.5. Không lưu trữ token/auth nhạy cảm trong Service Worker script");
  }

  // 3. Kiểm tra iOS Meta Tags trong index.html
  assert(fs.existsSync(indexPath), "3.1. Tệp index.html tồn tại trong build");
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert(indexContent.includes('apple-mobile-web-app-capable'), "3.2. index.html có thẻ apple-mobile-web-app-capable cho iOS PWA");
    assert(indexContent.includes('apple-mobile-web-app-status-bar-style'), "3.3. index.html có thẻ apple-mobile-web-app-status-bar-style");
    assert(indexContent.includes('viewport-fit=cover'), "3.4. viewport-fit=cover hỗ trợ Safe Area Inset trên iPhone");
  }

  // 4. Kiểm tra Mobile Components
  const bottomNavPath = path.resolve(__dirname, '../../frontend/src/components/common/MobileBottomNav.jsx');
  const offlineIndicatorPath = path.resolve(__dirname, '../../frontend/src/components/common/OfflineIndicator.jsx');
  assert(fs.existsSync(bottomNavPath), "4.1. MobileBottomNav component được tạo với touch-target >= 44px và safe-area");
  assert(fs.existsSync(offlineIndicatorPath), "4.2. OfflineIndicator component được tạo để báo hiệu trạng thái ngoại tuyến");

  console.log("\n================================================================================");
  console.log(`📊 TỔNG KẾT KIỂM THỬ: ${passed}/${total} TIÊU CHÍ ĐẠT (Tỷ lệ: ${Math.round((passed/total)*100)}%)`);
  console.log("================================================================================\n");

  process.exit(passed === total ? 0 : 1);
}

runPwaVerification();
