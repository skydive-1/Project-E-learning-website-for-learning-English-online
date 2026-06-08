/**
 * Auth Service - Xử lý logic nghiệp vụ xác thực người dùng
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
  async register({ email, username, password }) {
    // TODO: Triển khai kiểm tra email trùng lặp và lưu PostgreSQL thực tế
    
    // Giả lập hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return {
      email,
      username,
      createdAt: new Date().toISOString()
    };
  }

  async login({ email, password }) {
    // TODO: Triển khai truy vấn PostgreSQL để lấy user và verify mật khẩu
    
    // Giả lập tạo JWT Token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET chưa được cấu hình trên hệ thống');
    }

    const payload = {
      email,
      username: email.split('@')[0],
      role: 'student'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    return {
      token,
      user: payload
    };
  }
}

module.exports = new AuthService();
