/**
 * Email Utility - Xử lý gửi Email hệ thống thông qua Nodemailer & Gmail SMTP
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 */

const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

/**
 * Gửi email đến người nhận với định dạng HTML
 * @param {{ to: string, subject: string, html: string, text?: string }} options 
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('[Email Util]: Chưa cấu hình SMTP_USER và SMTP_PASS trong file .env');
      return false;
    }

    const from = process.env.EMAIL_FROM || `E-Learn Academy <${process.env.SMTP_USER}>`;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || 'Vui lòng xem nội dung email định dạng HTML.',
      html
    });

    console.log(`✅ [Email Service]: Đã gửi thành công email tới ${to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('❌ [Email Service Error]:', error);
    return false;
  }
};

module.exports = {
  createTransporter,
  sendEmail
};
