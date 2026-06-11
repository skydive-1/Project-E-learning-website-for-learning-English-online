/**
 * Auth Service - Xử lý logic nghiệp vụ xác thực người dùng
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../../config/database');

class AuthService {
  async register({ email, username, password }) {
    try {
      // 1. Kiểm tra email trùng lặp
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        const error = new Error('Email đã được sử dụng bởi một tài khoản khác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // 2. Hash mật khẩu trước khi lưu
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Lưu thông tin người dùng vào database PostgreSQL
      const queryText = `
        INSERT INTO users (email, password_hash, username, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, username, role, created_at
      `;
      const values = [email, hashedPassword, username, 'user'];
      const result = await db.query(queryText, values);

      const newUser = result.rows[0];

      return {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        createdAt: newUser.created_at
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw error;
      }

      console.error('Lỗi đăng ký trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình xử lý hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }

  async login({ email, password }) {
    try {
      // 1. Lấy thông tin user từ PostgreSQL
      const queryText = 'SELECT id, email, password_hash, username, role, is_active FROM users WHERE email = $1';
      const result = await db.query(queryText, [email]);

      if (result.rows.length === 0) {
        const error = new Error('Email hoặc mật khẩu không chính xác');
        error.name = 'AuthError';
        error.status = 401;
        throw error;
      }

      const user = result.rows[0];

      // Kiểm tra xem tài khoản có hoạt động không
      if (!user.is_active) {
        const error = new Error('Tài khoản đã bị khóa');
        error.name = 'AuthError';
        error.status = 403;
        throw error;
      }

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
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      if (error.name === 'AuthError' || error.message.includes('JWT_SECRET')) {
        throw error;
      }

      console.error('Lỗi đăng nhập trong AuthService:', error);
      const dbError = new Error('Có lỗi xảy ra trong quá trình xử lý hoặc kết nối cơ sở dữ liệu');
      dbError.name = 'DatabaseError';
      dbError.status = 503;
      throw dbError;
    }
  }

  async getProfile(userId) {
    try {
      // Lấy thông tin chi tiết người dùng từ database
      const queryText = 'SELECT id, email, username, full_name, role, is_active, created_at FROM users WHERE id = $1';
      const result = await db.query(queryText, [userId]);

      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
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
      const queryText = 'SELECT password_hash FROM users WHERE id = $1';
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

      // 4. Cập nhật mật khẩu mới vào database
      const updateQuery = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
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
}

module.exports = new AuthService();
