#!/usr/bin/env node
/**
 * Automation Tracking Script: Quét trạng thái hạn mức Gemini từ Google AI Studio (0 VND)
 *
 * Cách chạy:
 *   node backend/scripts/gemini_quota_tracker.js
 *   hoặc: npm run ai:track
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { probeGeminiModelsLive, getGeminiModelRoutingStatus } = require('../src/utils/ai-clients');
const db = require('../src/config/database');

async function run() {
  console.log('===============================================================');
  console.log('🚀 [GEMINI QUOTA TRACKER AUTOMATION] Bắt đầu quét Google AI Studio');
  console.log('⏰ Thời điểm quét:', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  console.log('===============================================================\n');

  try {
    const report = await probeGeminiModelsLive({ adminUserId: 'automation_tracker_script' });

    console.log('📊 KẾT QUẢ QUÉT TRỰC TIẾP TỪ GOOGLE AI STUDIO:');
    console.table(
      report.results.map((r) => ({
        'Model': r.model,
        'Trạng thái': r.status === 'healthy' ? '✅ 200 OK (Sẵn sàng)' : (r.status === 'rpd_exhausted' ? '⚠️ Hết RPD (Google 20/20)' : '❌ Lỗi Quota'),
        'Độ trễ': `${r.latencyMs} ms`,
        'Giới hạn Google': r.providerLimit ?? 'Không báo',
        'Chi tiết': r.message
      }))
    );

    console.log('\n🧭 TRẠNG THÁI ĐIỀU PHỐI (ROUTING STATUS):');
    console.log(`- Model ưu tiên (Preferred): ${report.routing.preferredModel}`);
    console.log(`- Model sẽ xử lý request kế tiếp (Effective): ${report.routing.effectiveModel}`);
    console.log(`- Thứ tự fallback: ${report.routing.fallbackOrder.join(' ➔ ')}`);

    if (report.routing.coolingDown && report.routing.coolingDown.length > 0) {
      console.log('\n⏳ CÁC MODEL ĐANG TRONG TRẠNG THÁI CHỜ / COOLDOWN:');
      console.table(
        report.routing.coolingDown.map((c) => ({
          'Model': c.model,
          'Nguyên nhân': c.dimension === 'rpd' ? 'Hết RPD trong ngày' : (c.dimension === 'rpm' ? 'Nghẽn RPM' : c.dimension),
          'Thời điểm hồi phục': new Date(c.retryAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
          'Nguồn ghi nhận': c.source
        }))
      );
    } else {
      console.log('\n✨ Không có model nào đang bị cooldown.');
    }

    console.log('\n✅ Quá trình đồng bộ CSDL hoàn tất thành công 100%.');
  } catch (err) {
    console.error('❌ Lỗi khi thực thi Quota Tracker:', err.message);
  } finally {
    try {
      if (db.pool && typeof db.pool.end === 'function') {
        await db.pool.end();
      }
    } catch {}
    process.exit(0);
  }
}

run();
