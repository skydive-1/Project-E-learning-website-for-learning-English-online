/**
 * Auth Controller - Chỉ tiếp nhận request và trả về response
 */

const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try {
    const { email, password, username, fullName } = req.body;
    const user = await authService.register({ email, password, username, fullName });
    
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
    // req.user được gán từ authMiddleware (chứa id, email, username, role)
    const user = await authService.getProfile(req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    await authService.changePassword({ userId, oldPassword, newPassword });
    
    res.status(200).json({
      success: true,
      message: 'Mật khẩu đã được thay đổi thành công'
    });
  } catch (error) {
    next(error);
  }
};
