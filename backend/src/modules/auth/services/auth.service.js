/**
 * Auth Service - Xử lý logic nghiệp vụ xác thực người dùng
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

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
      // Chặn đăng ký vai trò Admin hoặc các vai trò không hợp lệ qua API công khai
      let finalRoleId = parseInt(roleId, 10);
      if (finalRoleId !== 2 && finalRoleId !== 3) {
        finalRoleId = 3; // Chỉ cho phép đăng ký trực tiếp vai trò Student hoặc Instructor
      }

      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_id, email, username, full_name, role_id, created_date
      `;
      const values = [email, hashedPassword, username, fullName || username, finalRoleId];
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
      handleServiceError(error, 'Lỗi đăng ký trong AuthService');
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
      handleServiceError(error, 'Lỗi đăng nhập trong AuthService');
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
      handleServiceError(error, 'Lỗi lấy thông tin cá nhân trong AuthService');
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
      handleServiceError(error, 'Lỗi khi thay đổi mật khẩu trong AuthService');
    }
  }

  async updateProfile({ userId, username, fullName, profilePictureUrl, phone, gender, birthDate }) {
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
      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (gender !== undefined) {
        updates.push(`gender = $${paramIndex++}`);
        values.push(gender);
      }
      if (birthDate !== undefined) {
        updates.push(`birth_date = $${paramIndex++}`);
        // Xử lý giá trị trống hoặc null
        values.push(birthDate === '' ? null : birthDate);
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
        RETURNING user_id, email, username, full_name, profile_picture_url, phone, gender, birth_date, role_id
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
        phone: updatedUser.phone,
        gender: updatedUser.gender,
        birthDate: updatedUser.birth_date,
        roleId: updatedUser.role_id
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi cập nhật profile trong AuthService');
    }
  }

  async googleLogin(tokenData) {
    try {
      let token = tokenData;
      let isAccessToken = false;
      
      if (tokenData && typeof tokenData === 'object') {
        token = tokenData.token;
        isAccessToken = tokenData.isAccessToken;
      }
      
      let url = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
      if (isAccessToken) {
        url = `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error('Mã token Google không hợp lệ hoặc đã hết hạn');
        error.status = 400;
        throw error;
      }
      
      const payload = await response.json();
      if (payload.error_description) {
        const error = new Error(payload.error_description);
        error.status = 400;
        throw error;
      }

      const email = payload.email;
      const fullName = payload.name || payload.given_name || 'Google User';
      const profilePictureUrl = payload.picture || null;

      const result = await db.query(
        'SELECT user_id, email, username, full_name, role_id FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        
        const jwtPayload = {
          id: user.user_id,
          email: user.email,
          username: user.username,
          roleId: user.role_id
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRE || '24h'
        });

        return {
          isNewUser: false,
          token,
          user: {
            userId: user.user_id,
            email: user.email,
            username: user.username,
            fullName: user.full_name,
            roleId: user.role_id
          }
        };
      }

      const tempPayload = {
        email,
        fullName,
        profilePictureUrl
      };

      const tempToken = jwt.sign(tempPayload, process.env.JWT_SECRET, {
        expiresIn: '15m'
      });

      return {
        isNewUser: true,
        tempToken,
        email,
        fullName,
        profilePictureUrl
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi googleLogin trong AuthService');
    }
  }

  async googleConfirmRole({ tempToken, roleId }) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (err) {
        const error = new Error('Liên kết chọn vai trò đã hết hạn hoặc không hợp lệ');
        error.status = 400;
        throw error;
      }

      const { email, fullName, profilePictureUrl } = decoded;
      
      const targetRoleId = parseInt(roleId, 10);
      if (targetRoleId !== 2 && targetRoleId !== 3) {
        const error = new Error('Vai trò người dùng chọn không hợp lệ');
        error.status = 400;
        throw error;
      }

      const checkUser = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (checkUser.rows.length > 0) {
        const error = new Error('Tài khoản với email này đã tồn tại');
        error.status = 400;
        throw error;
      }

      let username = email.split('@')[0];
      const checkUsername = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
      if (checkUsername.rows.length > 0) {
        username = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const { v4: uuidv4 } = require('uuid');
      const randomPassword = uuidv4();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id, profile_picture_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, email, username, full_name, role_id, profile_picture_url, created_date
      `;
      const values = [email, hashedPassword, username, fullName, targetRoleId, profilePictureUrl];
      const result = await db.query(queryText, values);
      const newUser = result.rows[0];

      const jwtPayload = {
        id: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        roleId: newUser.role_id
      };

      const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
      });

      return {
        token,
        user: {
          userId: newUser.user_id,
          email: newUser.email,
          username: newUser.username,
          fullName: newUser.full_name,
          roleId: newUser.role_id,
          profilePictureUrl: newUser.profile_picture_url
        }
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi googleConfirmRole trong AuthService');
    }
  }
}

module.exports = new AuthService();
