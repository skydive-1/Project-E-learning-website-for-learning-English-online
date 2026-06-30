/**
 * Admin Service - Thực hiện các thao tác quản trị trên CSDL
 */

const { pool } = require('../../../config/database');

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
    
    // 1. Xóa tiến trình học tập (user_progress)
    await client.query('DELETE FROM user_progress WHERE user_id = $1', [userId]);
    
    // 2. Xóa lịch sử AI chat
    await client.query('DELETE FROM ai_chat WHERE student_id = $1', [userId]);
    
    // 3. Xóa thông tin chi tiết giảng viên (teachers)
    await client.query('DELETE FROM teachers WHERE user_id = $1', [userId]);
    
    // 4. Xóa thông tin chi tiết học sinh (students)
    await client.query('DELETE FROM students WHERE user_id = $1', [userId]);
    
    // 5. Cập nhật các khóa học do giảng viên này đứng lớp (instructor_id = null) thay vì xóa khóa học
    await client.query('UPDATE courses SET instructor_id = NULL WHERE instructor_id = $1', [userId]);

    // 6. Xóa tài khoản người dùng
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
