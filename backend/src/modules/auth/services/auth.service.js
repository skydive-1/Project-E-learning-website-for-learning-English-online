/**
 * Auth Service - Xử lý logic nghiệp vụ xác thực người dùng
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../../config/database');

class AuthService {
  async register({ email, username, password, fullName, roleId }) {
    try {
      // 1. Kiểm tra email trùng lặp
      const existingUser = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        const error = new Error('Email đã được sử dụng bởi một tài khoản khác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // 2. Hash mật khẩu trước khi lưu
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Lưu thông tin người dùng vào database PostgreSQL (mặc định role_id = 3 là Student)
      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_id, email, username, full_name, role_id, created_date
      `;
      const values = [email, hashedPassword, username, fullName || username, parseInt(roleId, 10) || 3];
      const result = await db.query(queryText, values);

      const newUser = result.rows[0];

      return {
        userId: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.full_name,
        roleId: newUser.role_id,
        createdDate: newUser.created_date
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw error;
      }

      console.error('Lỗi đăng ký trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình đăng ký hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }

  async login({ email, password }) {
    try {
      // 1. Lấy thông tin user từ PostgreSQL theo cấu trúc mới
      const queryText = 'SELECT user_id, email, password_hash, username, full_name, role_id FROM users WHERE email = $1';
      const result = await db.query(queryText, [email]);

      if (result.rows.length === 0) {
        const error = new Error('Email hoặc mật khẩu không chính xác');
        error.name = 'AuthError';
        error.status = 401;
        throw error;
      }

      const user = result.rows[0];

      // 2. Kiểm tra mật khẩu (verify password)
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        const error = new Error('Email hoặc mật khẩu không chính xác');
        error.name = 'AuthError';
        error.status = 401;
        throw error;
      }

      // 3. Tạo JWT Token
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET chưa được cấu hình trên hệ thống');
      }

      const payload = {
        id: user.user_id,
        email: user.email,
        username: user.username,
        roleId: user.role_id
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
      });

      return {
        token,
        user: {
          userId: user.user_id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          roleId: user.role_id
        }
      };
    } catch (error) {
      if (error.name === 'AuthError' || error.message.includes('JWT_SECRET')) {
        throw error;
      }

      console.error('Lỗi đăng nhập trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình đăng nhập hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }

  async getProfile(userId) {
    try {
      // Lấy thông tin chi tiết người dùng từ database theo cấu trúc mới
      const queryText = 'SELECT user_id, email, username, full_name, birth_date, phone, role_id, gender, created_date FROM users WHERE user_id = $1';
      const result = await db.query(queryText, [userId]);

      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const user = result.rows[0];
      return {
        userId: user.user_id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        birthDate: user.birth_date,
        phone: user.phone,
        roleId: user.role_id,
        gender: user.gender,
        createdDate: user.created_date
      };
    } catch (error) {
      if (error.name === 'AuthError') {
        throw error;
      }

      console.error('Lỗi lấy thông tin cá nhân trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình xử lý hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }

  async changePassword({ userId, oldPassword, newPassword }) {
    try {
      // 1. Lấy mật khẩu cũ từ database
      const queryText = 'SELECT password_hash FROM users WHERE user_id = $1';
      const result = await db.query(queryText, [userId]);

      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const user = result.rows[0];

      // 2. Kiểm tra mật khẩu cũ
      const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isMatch) {
        const error = new Error('Mật khẩu cũ không chính xác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // 3. Hash mật khẩu mới trước khi lưu
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 4. Cập nhật mật khẩu mới vào database (loại bỏ updated_at vì bảng mới không có)
      const updateQuery = 'UPDATE users SET password_hash = $1 WHERE user_id = $2';
      await db.query(updateQuery, [hashedPassword, userId]);

      return true;
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'AuthError') {
        throw error;
      }

      console.error('Lỗi khi thay đổi mật khẩu trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình xử lý hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }

  async updateProfile({ userId, username, fullName, profilePictureUrl }) {
    try {
      // 1. Kiểm tra username trùng lặp nếu có đổi
      if (username) {
        const existingUser = await db.query('SELECT user_id FROM users WHERE username = $1 AND user_id != $2', [username, userId]);
        if (existingUser.rows.length > 0) {
          const error = new Error('Tên người dùng đã được sử dụng');
          error.name = 'ValidationError';
          error.status = 400;
          throw error;
        }
      }

      // 2. Tạo câu query động để cập nhật
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (username) {
        updates.push(`username = $${paramIndex++}`);
        values.push(username);
      }
      if (fullName) {
        updates.push(`full_name = $${paramIndex++}`);
        values.push(fullName);
      }
      if (profilePictureUrl !== undefined) {
        updates.push(`profile_picture_url = $${paramIndex++}`);
        values.push(profilePictureUrl);
      }

      if (updates.length === 0) {
        const error = new Error('Không có thông tin nào để cập nhật');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      values.push(userId);
      const queryText = `
        UPDATE users 
        SET ${updates.join(', ')} 
        WHERE user_id = $${paramIndex}
        RETURNING user_id, email, username, full_name, profile_picture_url, role_id
      `;

      const result = await db.query(queryText, values);
      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const updatedUser = result.rows[0];
      return {
        userId: updatedUser.user_id,
        email: updatedUser.email,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        profilePictureUrl: updatedUser.profile_picture_url,
        roleId: updatedUser.role_id
      };
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'AuthError') {
        throw error;
      }
      console.error('Lỗi cập nhật profile trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình cập nhật hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }
}

module.exports = new AuthService();
