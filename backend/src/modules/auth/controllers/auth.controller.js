/**
 * Auth Controller - Chỉ tiếp nhận request và trả về response
 */

const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try {
    const { email, password, username } = req.body;
    const user = await authService.register({ email, password, username });
    
    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản mới thành công',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    
    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // TODO: Triển khai thu hồi token/blacklist token nếu cần
    res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    // req.user được gán từ authMiddleware
    res.status(200).json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công',
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};
