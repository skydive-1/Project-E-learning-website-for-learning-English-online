/**
 * Consultation Controller - Xử lý tiếp nhận yêu cầu Đăng ký tư vấn miễn phí
 */

const consultationService = require('./consultation.service');

const registerConsultation = async (req, res, next) => {
  try {
    const { fullname, email } = req.body;

    if (!fullname || !fullname.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập Họ và tên của bạn.'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập địa chỉ Gmail của bạn.'
      });
    }

    // Regex kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ Gmail không đúng định dạng. Vui lòng kiểm tra lại.'
      });
    }

    // Gửi email lộ trình học tự động qua Nodemailer Service
    const mailResult = await consultationService.sendRoadmapEmail(fullname.trim(), email.trim());

    return res.status(200).json({
      success: true,
      message: 'Đăng ký tư vấn thành công! Hệ thống đã tự động gửi Lộ trình học cá nhân hóa vào hòm thư Gmail của bạn.',
      data: {
        fullname: fullname.trim(),
        email: email.trim(),
        emailSimulated: mailResult.simulated || false
      }
    });

  } catch (error) {
    console.error('❌ Lỗi xử lý đăng ký tư vấn:', error);
    next(error);
  }
};

module.exports = {
  registerConsultation
};
