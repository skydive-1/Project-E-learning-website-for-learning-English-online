/**
 * Admin Service - Thực hiện các thao tác quản trị trên CSDL
 */

const { pool } = require('../../../config/database');
const { supabaseAdmin } = require('../../../config/supabase');

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
      r.role_name
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
 * Xóa tài khoản người dùng kèm theo các dữ liệu liên quan để tránh vi phạm ràng buộc khóa ngoại
 * @param {number} userId - ID của người dùng cần xóa
 */
const deleteUser = async (userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lấy thông tin supabase_uid để xóa tài khoản trên Supabase Auth
    const userRes = await client.query('SELECT supabase_uid FROM users WHERE user_id = $1', [userId]);
    if (userRes.rows.length > 0) {
      const supabaseUid = userRes.rows[0].supabase_uid;
      if (supabaseUid && supabaseAdmin) {
        try {
          const { error: sbErr } = await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
          if (sbErr) {
            console.warn(`⚠️ Cảnh báo: Không thể xóa user ${userId} trên Supabase Auth:`, sbErr.message);
          } else {
            console.log(`✅ Đã xóa user ${userId} trên Supabase Auth`);
          }
        } catch (sbException) {
          console.warn(`⚠️ Ngoại lệ khi xóa user trên Supabase Auth:`, sbException.message);
        }
      }
    }
    
    // 2. Xóa tiến trình học tập (user_progress)
    await client.query('DELETE FROM user_progress WHERE user_id = $1', [userId]);
    
    // 3. Xóa lịch sử AI chat
    await client.query('DELETE FROM ai_chat WHERE student_id = $1', [userId]);

    // 4. Xóa thông tin chi tiết giảng viên (teachers) (nếu bảng tồn tại)
    const teachersExistRes = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'teachers'
      );
    `);
    if (teachersExistRes.rows[0].exists) {
      await client.query('DELETE FROM teachers WHERE user_id = $1', [userId]);
    }

    // 5. Xóa thông tin chi tiết học sinh (students) (nếu bảng tồn tại)
    const studentsExistRes = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'students'
      );
    `);
    if (studentsExistRes.rows[0].exists) {
      await client.query('DELETE FROM students WHERE user_id = $1', [userId]);
    }
    
    // 6. Cập nhật các khóa học do giảng viên này đứng lớp (instructor_id = null) thay vì xóa khóa học
    await client.query('UPDATE courses SET instructor_id = NULL WHERE instructor_id = $1', [userId]);

    // 5. Xóa tài khoản người dùng cục bộ
    const result = await client.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, username, email', 
      [userId]
    );
    
    if (result.rows.length === 0) {
      const error = new Error('Không tìm thấy người dùng để xóa');
      error.status = 404;
      throw error;
    }
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reset token cho một người dùng bằng cách đặt used_tokens = 0 và reset_date = hôm nay
 */
const resetUserToken = async (userId) => {
  const userRes = await pool.query('SELECT role_id FROM users WHERE user_id = $1', [userId]);
  if (userRes.rows.length === 0) {
    const error = new Error('Không tìm thấy người dùng');
    error.status = 404;
    throw error;
  }
  
  const roleId = userRes.rows[0].role_id;
  let limit = 6000;
  if (roleId === 1) limit = 999999999;
  else if (roleId === 2) limit = 7000;

  const today = getVietnamDateString();

  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date, updated_at)
    VALUES ($1, $2, 0, $3, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET used_tokens = 0, max_tokens = $2, reset_date = $3, updated_at = NOW()
    RETURNING *
  `;
  const result = await pool.query(query, [userId, limit, today]);
  return result.rows[0];
};

/**
 * Reset token hàng loạt cho toàn bộ người dùng thuộc một Role cụ thể
 */
const resetTokensByRole = async (roleId) => {
  let limit = 6000;
  if (roleId === 1) limit = 999999999;
  else if (roleId === 2) limit = 7000;

  const today = getVietnamDateString();

  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date, updated_at)
    SELECT user_id, $1, 0, $2, NOW()
    FROM users
    WHERE role_id = $3
    ON CONFLICT (user_id) DO UPDATE
    SET used_tokens = 0, max_tokens = $1, reset_date = $2, updated_at = NOW()
    RETURNING *
  `;
  const result = await pool.query(query, [limit, today, roleId]);
  return result.rows;
};

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  resetUserToken,
  resetTokensByRole
};
