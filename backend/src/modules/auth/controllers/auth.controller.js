/**
 * Auth Controller - Xử lý đăng ký, đăng nhập, đăng xuất, thông tin người dùng
 */

exports.register = async (req, res, next) => {
  try {
    const { email, password, username } = req.body;
    // TODO: Triển khai lưu người dùng vào database (PostgreSQL)
    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản mới thành công (Placeholder)',
      data: { email, username }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // TODO: Triển khai kiểm tra thông tin đăng nhập và sinh JWT Token
    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công (Placeholder)',
      token: 'dummy-jwt-token'
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công (Placeholder)'
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
      message: 'Lấy thông tin cá nhân thành công (Placeholder)',
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};
