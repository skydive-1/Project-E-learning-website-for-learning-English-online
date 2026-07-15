/**
 * Admin Service - Thực hiện các thao tác quản trị trên CSDL
 */

const { pool } = require('../../../config/database');
const { supabaseAdmin } = require('../../../config/supabase');

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

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser
};
