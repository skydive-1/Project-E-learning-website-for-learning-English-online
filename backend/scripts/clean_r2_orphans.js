require('dotenv').config();
const r2ReconciliationService = require('../src/utils/r2Reconciliation.service');
const { pool } = require('../src/config/database');

async function run() {
  console.log('🚀 Khởi chạy tiến trình tự động quét và dọn dẹp file rác Cloudflare R2...');
  const result = await r2ReconciliationService.reconcile({ dryRun: false, autoDelete: true });
  console.log('\n=========================================');
  console.log('KẾT QUẢ TỰ ĐỘNG DỌN DẸP R2:');
  console.log(`- Tổng số tệp đã quét: ${result.totalScanned}`);
  console.log(`- Số tệp hợp lệ được bảo vệ: ${result.activeCount}`);
  console.log(`- Số tệp rác phát hiện: ${result.orphanCount}`);
  console.log(`- Số tệp đã xóa thành công: ${result.deletedCount}`);
  console.log(`- Dung lượng giải phóng: ${result.freedMb} MB (${(result.freedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
  console.log(`- Số tệp còn lại trên R2: ${result.remainingCount}`);
  console.log('=========================================\n');
  await pool.end();
}

run().catch((err) => {
  console.error('Lỗi dọn dẹp R2:', err);
  process.exit(1);
});
