/**
 * Email Utility - Xử lý gửi Email hệ thống thông qua Nodemailer & Gmail SMTP
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 */

const nodemailer = require('nodemailer');

const parseTimeout = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value >= 1000 ? value : fallback;
};

const SMTP_CONNECTION_TIMEOUT_MS = () => parseTimeout('SMTP_CONNECTION_TIMEOUT_MS', 8000);
const SMTP_GREETING_TIMEOUT_MS = () => parseTimeout('SMTP_GREETING_TIMEOUT_MS', 8000);
const SMTP_SOCKET_TIMEOUT_MS = () => parseTimeout('SMTP_SOCKET_TIMEOUT_MS', 12000);
const SMTP_SEND_TIMEOUT_MS = () => parseTimeout('SMTP_SEND_TIMEOUT_MS', 15000);

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
    auth: { user, pass },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS(),
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS(),
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS()
  });
};

const sendMailWithTimeout = (transporter, message, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    const error = new Error(`SMTP send timed out after ${timeoutMs}ms`);
    error.code = 'SMTP_SEND_TIMEOUT';
    reject(error);
  }, timeoutMs);

  transporter.sendMail(message).then(
    (info) => {
      clearTimeout(timer);
      resolve(info);
    },
    (error) => {
      clearTimeout(timer);
      reject(error);
    }
  );
});

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

    let info;
    try {
      info = await sendMailWithTimeout(transporter, {
        from,
        to,
        subject,
        text: text || 'Vui lòng xem nội dung email định dạng HTML.',
        html
      }, SMTP_SEND_TIMEOUT_MS());
    } finally {
      // Không giữ socket SMTP sống sau khi request HTTP đã hoàn tất hoặc timeout.
      transporter.close();
    }

    console.log(`✅ [Email Service]: Đã gửi thành công email tới ${to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('❌ [Email Service Error]:', error);
    return false;
  }
};

module.exports = {
  createTransporter,
  sendEmail,
  sendMailWithTimeout
};
