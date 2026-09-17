/**
 * Đồng bộ ngày tham gia (created_date) và liên kết tài khoản giữa Supabase Auth và PostgreSQL
 * Run with: node scripts/sync_supabase_joined_dates.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/config/database');
const { supabaseAdmin } = require('../src/config/supabase');

async function syncJoinedDates() {
  console.log('🔄 Bắt đầu đối soát và đồng bộ ngày tham gia từ Supabase Auth sang PostgreSQL...');

  try {
    // 1. Lấy danh sách users từ Supabase Auth
    let supaUsers = [];
    if (supabaseAdmin && supabaseAdmin.auth && supabaseAdmin.auth.admin) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        console.error('❌ Lỗi lấy danh sách user từ Supabase Auth:', error.message);
      } else {
        supaUsers = data?.users || [];
      }
    } else {
      console.warn('⚠️ Supabase Admin chưa được cấu hình hoặc thiếu service role key.');
    }

    console.log(`📊 Tìm thấy ${supaUsers.length} tài khoản trên Supabase Auth.`);

    // 2. Lấy danh sách users từ PostgreSQL
    const dbRes = await db.query(
      'SELECT user_id, username, email, full_name, supabase_uid, created_date FROM users ORDER BY user_id ASC'
    );
    const dbUsers = dbRes.rows;
    console.log(`📊 Tìm thấy ${dbUsers.length} tài khoản trong PostgreSQL Database.`);

    let syncedCount = 0;
    let fallbackCount = 0;

    for (const user of dbUsers) {
      const cleanEmail = (user.email || '').trim().toLowerCase();
      const supaMatch = supaUsers.find(
        (su) =>
          (user.supabase_uid && su.id === user.supabase_uid) ||
          (su.email && su.email.trim().toLowerCase() === cleanEmail)
      );

      if (supaMatch) {
        const supaCreatedAt = supaMatch.created_at;
        const supaUid = supaMatch.id;

        await db.query(
          `UPDATE users 
           SET created_date = $1, 
               supabase_uid = COALESCE(supabase_uid, $2)
           WHERE user_id = $3`,
          [supaCreatedAt, supaUid, user.user_id]
        );

        console.log(
          `✅ [Synced] User #${user.user_id} (${user.email}) -> Joined: ${supaCreatedAt} (UID: ${supaUid})`
        );
        syncedCount++;
      } else {
        // Nếu user không có trên Supabase (user seed hoặc demo cục bộ)
        if (!user.created_date) {
          await db.query(
            'UPDATE users SET created_date = CURRENT_TIMESTAMP WHERE user_id = $1',
            [user.user_id]
          );
          console.log(`⚠️ [Fallback] User #${user.user_id} (${user.email}) -> Đặt mốc CURRENT_TIMESTAMP.`);
          fallbackCount++;
        } else {
          console.log(
            `ℹ️ [Retained] User #${user.user_id} (${user.email}) -> Giữ nguyên ngày tạo DB: ${new Date(user.created_date).toISOString()}`
          );
        }
      }
    }

    console.log('\n============================================================');
    console.log(`🎉 Hoàn tất đồng bộ:`);
    console.log(`- Đã đồng bộ chính xác với Supabase: ${syncedCount}/${dbUsers.length} users`);
    console.log(`- Tài khoản seed/local giữ nguyên hợp lệ: ${dbUsers.length - syncedCount} users`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('❌ Lỗi khi đồng bộ dữ liệu:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

syncJoinedDates();
