/**
 * Admin Service - Thực hiện các thao tác quản trị trên CSDL
 */

const { pool } = require('../../../config/database');
const { supabaseAdmin } = require('../../../config/supabase');
const { handleServiceError } = require('../../../utils/service-errors');

// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

/**
 * Lấy danh sách tất cả người dùng kèm thông tin vai trò
 */
const getAllUsers = async () => {
  const query = `
    SELECT 
      u.user_id,
      u.username,
      u.email,
      u.full_name,
      u.created_date,
      u.role_id,
      COALESCE(r.role_name, CASE WHEN u.role_id = 1 THEN 'Admin' WHEN u.role_id = 2 THEN 'Instructor' ELSE 'Student' END) as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.role_id
    ORDER BY u.created_date DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

/**
 * Cập nhật vai trò (role_id) của người dùng
 * @param {number} userId - ID của người dùng cần cập nhật
 * @param {number} roleId - ID vai trò mới (1: Admin, 2: Instructor, 3: Student)
 */
const updateUserRole = async (userId, roleId) => {
  const query = `
    UPDATE users 
    SET role_id = $1 
    WHERE user_id = $2 
    RETURNING user_id, username, email, role_id
  `;
  const result = await pool.query(query, [roleId, userId]);
  
  if (result.rows.length === 0) {
    const error = new Error('Không tìm thấy người dùng');
    error.status = 404;
    throw error;
  }
  
  return result.rows[0];
};

/**
 * Xóa tài khoản người dùng triệt để (xóa sạch ở tất cả các bảng liên quan để tránh dính lỗi khóa ngoại)
 * @param {number} userId - ID của người dùng cần xóa
 */
const deleteUser = async (userId) => {
  // 1. Lấy thông tin email & supabase_uid để xóa tài khoản trên Supabase Auth
  const userRes = await pool.query('SELECT email, supabase_uid FROM users WHERE user_id = $1', [userId]);
  if (userRes.rows.length === 0) {
    const error = new Error('Không tìm thấy người dùng để xóa');
    error.status = 404;
    throw error;
  }

  const { email: targetEmail, supabase_uid: supabaseUid } = userRes.rows[0];

  const client = await pool.connect();
  let deletedUserRow = null;

  try {
    await client.query('BEGIN');

    // Dọn dẹp tất cả các bảng liên quan đến user_id trong schema public trước khi xóa trong users
    const tablesToClean = [
      { table: 'user_token_usage', col: 'user_id' },
      { table: 'user_token_limits', col: 'user_id' },
      { table: 'quiz_attempts', col: 'user_id' },
      { table: 'user_progress', col: 'user_id' },
      { table: 'ai_chat', col: 'student_id' },
      { table: 'teachers', col: 'user_id' },
      { table: 'students', col: 'user_id' }
    ];

    for (const item of tablesToClean) {
      const checkExist = await client.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [item.table]
      );
      if (checkExist.rows[0].exists) {
        await client.query(`DELETE FROM ${item.table} WHERE ${item.col} = $1`, [userId]);
      }
    }

    // Cập nhật instructor_id = NULL ở bảng courses nếu có
    const checkCourses = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courses')"
    );
    if (checkCourses.rows[0].exists) {
      await client.query('UPDATE courses SET instructor_id = NULL WHERE instructor_id = $1', [userId]);
    }

    // Xóa chính tài khoản trong bảng users
    const result = await client.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, username, email', 
      [userId]
    );

    await client.query('COMMIT');
    deletedUserRow = result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Lỗi CSDL khi xóa người dùng ${userId}:`, error);
    handleServiceError(error, 'Lỗi xóa người dùng trong AdminService');
  } finally {
    client.release();
  }

  // 2. Xóa tài khoản trên Supabase Auth SDK và auth.users ngoài Transaction block
  if (supabaseUid && supabaseAdmin) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      console.log(`✅ Đã xóa user ${userId} trên Supabase Auth SDK`);
    } catch (sbException) {
      console.warn(`⚠️ Cảnh báo khi xóa user trên Supabase Auth SDK:`, sbException.message);
    }
  }

  try {
    await pool.query('DELETE FROM auth.users WHERE email = $1 OR id = $2', [targetEmail, supabaseUid]);
  } catch (authSqlErr) {
    // Bỏ qua nếu CSDL local không có schema auth
  }

  return deletedUserRow;
};

/**
 * Reset token cho một tài khoản cụ thể (đưa used_tokens về 0)
 * @param {number} userId - ID của người dùng cần reset token
 */
const resetUserToken = async (userId) => {
  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date)
    VALUES ($1, 6000, 0, $2)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      used_tokens = 0,
      reset_date = EXCLUDED.reset_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, max_tokens, used_tokens, reset_date
  `;
  const result = await pool.query(query, [userId, getVietnamDateString()]);
  return result.rows[0];
};

/**
 * Reset token hàng loạt cho toàn bộ người dùng theo Role (Học sinh/Giảng viên)
 * @param {number} roleId - ID vai trò cần reset token (2: Instructor, 3: Student)
 */
const resetTokensByRole = async (roleId) => {
  const todayStr = getVietnamDateString();
  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date)
    SELECT user_id, 6000, 0, $1
    FROM users
    WHERE role_id = $2
    ON CONFLICT (user_id)
    DO UPDATE SET
      used_tokens = 0,
      reset_date = EXCLUDED.reset_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, used_tokens, reset_date
  `;
  const result = await pool.query(query, [todayStr, roleId]);
  return result.rows;
};

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  resetUserToken,
  resetTokensByRole
};
