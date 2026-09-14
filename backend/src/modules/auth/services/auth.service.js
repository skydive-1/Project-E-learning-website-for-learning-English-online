/**
 * Auth Service - Xử lý logic nghiệp vụ xác thực người dùng
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');
const { supabaseAdmin, supabaseClient } = require('../../../config/supabase');
const { createClient } = require('@supabase/supabase-js');
const { isSuperAdminUser } = require('../../../utils/superAdmin.util');

const isValidImageBuffer = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  return false;
};

const parseTimeout = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value >= 1000 ? value : fallback;
};

const withTimeout = (promise, timeoutMs, operation) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    const error = new Error(`${operation} timed out after ${timeoutMs}ms`);
    error.code = 'UPSTREAM_TIMEOUT';
    reject(error);
  }, timeoutMs);

  Promise.resolve(promise).then(
    (value) => {
      clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      clearTimeout(timer);
      reject(error);
    }
  );
});

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getFrontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')[0]
  .trim()
  .replace(/\/$/, '');

const getEmailVerificationTtlHours = () => {
  const configured = Number.parseInt(process.env.EMAIL_VERIFICATION_TTL_HOURS || '', 10);
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 168
    ? configured
    : 24;
};

const hashEmailVerificationToken = (token) => crypto
  .createHash('sha256')
  .update(String(token || ''))
  .digest('hex');

class AuthService {
  async sendVerificationEmail(user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashEmailVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + getEmailVerificationTtlHours() * 60 * 60 * 1000);

    await db.query(
      `UPDATE users
       SET email_verification_token_hash = $1,
           email_verification_expires_at = $2
       WHERE user_id = $3`,
      [tokenHash, expiresAt, user.user_id]
    );

    const verificationLink = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
    const safeDisplayName = escapeHtml(user.full_name || user.username || 'bạn');
    const safeVerificationLink = escapeHtml(verificationLink);
    const ttlHours = getEmailVerificationTtlHours();

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #38bdf8; font-size: 24px; font-weight: 700; margin: 0;">E-LEARN ACADEMY</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Xác minh địa chỉ email của bạn</p>
        </div>
        <div style="background-color: #1e293b; padding: 24px; border-radius: 12px;">
          <h2 style="color: #f1f5f9; font-size: 18px; margin-top: 0;">Chào ${safeDisplayName},</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.65;">
            Nhấn nút bên dưới để xác minh email và kích hoạt tài khoản E-Learn Academy của bạn.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${safeVerificationLink}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
              XÁC MINH EMAIL
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.55;">
            Hoặc sao chép liên kết này vào trình duyệt:<br />
            <a href="${safeVerificationLink}" style="color: #7dd3fc; word-break: break-all;">${safeVerificationLink}</a>
          </p>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.55; margin: 20px 0 0; text-align: center;">
          Liên kết có hiệu lực trong ${ttlHours} giờ. Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.
        </p>
      </div>
    `;

    const { sendEmail } = require('../../../utils/email.util');
    const sent = await sendEmail({
      to: user.email,
      subject: '[E-Learn Academy] Xác minh địa chỉ email của bạn',
      text: `Chào ${user.full_name || user.username || 'bạn'}, xác minh email tại: ${verificationLink}. Liên kết có hiệu lực trong ${ttlHours} giờ.`,
      html
    });

    if (!sent) {
      console.error(`[Email Verification]: Không thể gửi email xác minh cho user_id=${user.user_id}`);
    }

    return { sent, expiresAt };
  }

  async register({ email, username, password, fullName, roleId }) {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase Admin client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanUsername = String(username || '').trim();
      const cleanFullName = String(fullName || cleanUsername).trim();

      // 1. Kiểm tra email trùng lặp trong PostgreSQL cục bộ
      const existingUser = await db.query('SELECT user_id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (existingUser.rows.length > 0) {
        const error = new Error('Email đã được sử dụng bởi một tài khoản khác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // Kiểm tra username trùng lặp
      const existingUsername = await db.query('SELECT user_id FROM users WHERE username = $1', [cleanUsername]);
      if (existingUsername.rows.length > 0) {
        const error = new Error('Tên đăng nhập (username) đã tồn tại');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // Tự động gán Admin cho email được ủy quyền hoặc giới hạn vai trò công khai
      let finalRoleId = parseInt(roleId, 10);
      const adminEmails = ['quocanh26012004@gmail.com', 'bte290904@gmail.com'];
      if (adminEmails.includes(cleanEmail)) {
        finalRoleId = 1; // Admin
      } else if (finalRoleId !== 2 && finalRoleId !== 3) {
        finalRoleId = 3; // Chỉ cho phép đăng ký trực tiếp vai trò Student hoặc Instructor
      }

      // 2. Tạo tài khoản Supabase ở trạng thái chưa xác minh.
      // Email chỉ được xác nhận sau khi người dùng mở liên kết một lần do hệ thống gửi.
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: false,
        user_metadata: {
          username: cleanUsername,
          full_name: cleanFullName,
          role_id: finalRoleId
        }
      });

      if (authError) {
        throw authError;
      }

      const supabaseUser = authData.user;

      // 3. Lưu thông tin người dùng vào database PostgreSQL (sử dụng supabase_uid)
      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id, supabase_uid)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, email, username, full_name, role_id, created_date, supabase_uid
      `;
      const values = [cleanEmail, '', cleanUsername, cleanFullName, finalRoleId, supabaseUser.id];
      const result = await db.query(queryText, values);

      const newUser = result.rows[0];
      const delivery = await this.sendVerificationEmail(newUser);

      return {
        userId: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.full_name,
        roleId: newUser.role_id,
        createdDate: newUser.created_date,
        requiresEmailVerification: true,
        emailDeliveryAccepted: delivery.sent,
        verificationExpiresAt: delivery.expiresAt.toISOString()
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi đăng ký trong AuthService');
    }
  }

  async login({ email, password }) {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase Client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      const cleanEmail = String(email || '').trim().toLowerCase();
      const localAccount = await db.query(
        'SELECT user_id, email_verified_at FROM users WHERE LOWER(email) = $1',
        [cleanEmail]
      );

      if (localAccount.rows.length > 0 && !localAccount.rows[0].email_verified_at) {
        const error = new Error('Email chưa được xác minh. Vui lòng kiểm tra hộp thư hoặc gửi lại email xác minh.');
        error.name = 'EmailVerificationError';
        error.status = 403;
        error.code = 'EMAIL_NOT_VERIFIED';
        throw error;
      }

      // 1. Đăng nhập qua Supabase Auth
      let authData;
      let authError;
      try {
        const res = await supabaseClient.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        authData = res.data;
        authError = res.error;
      } catch (err) {
        authError = err;
      }

      let supabaseUser;
      let user;

      if (authError) {
        if (/email\s+(?:not\s+confirmed|not\s+verified)/i.test(authError.message || '')) {
          const error = new Error('Email chưa được xác minh. Vui lòng kiểm tra hộp thư hoặc gửi lại email xác minh.');
          error.name = 'EmailVerificationError';
          error.status = 403;
          error.code = 'EMAIL_NOT_VERIFIED';
          throw error;
        }

        // Tự động di trú người dùng cũ (Lazy Migration / Shadow Migration):
        // Nếu không đăng nhập được qua Supabase, kiểm tra xem user có tồn tại ở PostgreSQL cục bộ với mật khẩu cũ không
        const localUserQuery = 'SELECT user_id, email, password_hash, username, full_name, role_id, supabase_uid, email_verified_at, profile_picture_url FROM users WHERE LOWER(email) = $1';
        const localUserResult = await db.query(localUserQuery, [cleanEmail]);

        if (localUserResult.rows.length > 0) {
          const matchedUser = localUserResult.rows[0];
          // Nếu tài khoản cũ chưa được đồng bộ và có password_hash (hệ thống cũ)
          if (matchedUser.password_hash) {
            const isMatch = await bcrypt.compare(password, matchedUser.password_hash);
            if (isMatch) {
              console.log(`[Lazy Migration] Đang di trú tài khoản cũ sang Supabase Auth: ${cleanEmail}`);
              // Tạo tài khoản trên Supabase Auth bằng Admin SDK
              const { data: migratedData, error: migrateError } = await supabaseAdmin.auth.admin.createUser({
                email: cleanEmail,
                password,
                email_confirm: true,
                user_metadata: {
                  username: matchedUser.username,
                  full_name: matchedUser.full_name,
                  role_id: matchedUser.role_id
                }
              });

              if (migrateError) {
                console.error('❌ Lỗi tự động di trú sang Supabase Auth:', migrateError.message);
                const error = new Error('Email hoặc mật khẩu không chính xác');
                error.name = 'AuthError';
                error.status = 401;
                throw error;
              }

              supabaseUser = migratedData.user;
              // Cập nhật supabase_uid vào PostgreSQL cục bộ để liên kết
              await db.query('UPDATE users SET supabase_uid = $1 WHERE user_id = $2', [supabaseUser.id, matchedUser.user_id]);

              user = matchedUser;
              user.supabase_uid = supabaseUser.id;
            } else {
              const error = new Error('Email hoặc mật khẩu không chính xác');
              error.name = 'AuthError';
              error.status = 401;
              throw error;
            }
          } else {
            const error = new Error('Email hoặc mật khẩu không chính xác');
            error.name = 'AuthError';
            error.status = 401;
            throw error;
          }
        } else {
          const error = new Error('Email hoặc mật khẩu không chính xác');
          error.name = 'AuthError';
          error.status = 401;
          throw error;
        }
      } else {
        supabaseUser = authData.user;

        // 2. Tìm kiếm thông tin user cục bộ bằng supabase_uid hoặc email để liên kết
        const queryText = 'SELECT user_id, email, username, full_name, role_id, supabase_uid, email_verified_at, profile_picture_url FROM users WHERE supabase_uid = $1 OR LOWER(email) = $2';
        const result = await db.query(queryText, [supabaseUser.id, cleanEmail]);

        if (result.rows.length === 0) {
          // Tự động đồng bộ nếu user tồn tại trên Supabase nhưng chưa có ở DB của mình
          const roleId = supabaseUser.user_metadata?.role_id || 3;
          const username = supabaseUser.user_metadata?.username || cleanEmail.split('@')[0];
          const fullName = supabaseUser.user_metadata?.full_name || username;

          const insertQuery = `
            INSERT INTO users (email, password_hash, username, full_name, role_id, supabase_uid, email_verified_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            RETURNING user_id, email, username, full_name, role_id, supabase_uid, email_verified_at, profile_picture_url
          `;
          const insertRes = await db.query(insertQuery, [cleanEmail, '', username, fullName, roleId, supabaseUser.id]);
          user = insertRes.rows[0];
        } else {
          user = result.rows[0];
          // Nếu user cũ chưa có supabase_uid, tự động cập nhật liên kết
          if (!user.supabase_uid) {
            await db.query('UPDATE users SET supabase_uid = $1 WHERE user_id = $2', [supabaseUser.id, user.user_id]);
            user.supabase_uid = supabaseUser.id;
          }
        }
      }

      // 3. Tạo local JWT Token trả về cho client giống hệ thống cũ
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
          profilePictureUrl: user.profile_picture_url || null,
          roleId: user.role_id,
          isSuperAdmin: isSuperAdminUser(user)
        }
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi đăng nhập trong AuthService');
    }
  }

  async verifyEmail(token) {
    try {
      const cleanToken = String(token || '').trim();
      if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
        const error = new Error('Liên kết xác minh email không hợp lệ.');
        error.name = 'ValidationError';
        error.status = 400;
        error.code = 'EMAIL_VERIFICATION_INVALID';
        throw error;
      }

      const tokenHash = hashEmailVerificationToken(cleanToken);
      const result = await db.query(
        `SELECT user_id, email, username, full_name, supabase_uid,
                email_verified_at, email_verification_expires_at
         FROM users
         WHERE email_verification_token_hash = $1`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        const error = new Error('Liên kết xác minh email không hợp lệ hoặc đã được sử dụng.');
        error.name = 'ValidationError';
        error.status = 400;
        error.code = 'EMAIL_VERIFICATION_INVALID';
        throw error;
      }

      const user = result.rows[0];
      if (!user.email_verification_expires_at || new Date(user.email_verification_expires_at).getTime() <= Date.now()) {
        const error = new Error('Liên kết xác minh email đã hết hạn. Vui lòng yêu cầu gửi lại email.');
        error.name = 'ValidationError';
        error.status = 400;
        error.code = 'EMAIL_VERIFICATION_EXPIRED';
        throw error;
      }

      if (!user.supabase_uid) {
        const error = new Error('Tài khoản chưa được liên kết với hệ thống xác thực.');
        error.status = 500;
        error.code = 'AUTH_ACCOUNT_LINK_MISSING';
        throw error;
      }

      const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
        user.supabase_uid,
        { email_confirm: true }
      );

      if (confirmError) {
        const error = new Error('Không thể xác minh email lúc này. Vui lòng thử lại sau.');
        error.status = 503;
        error.code = 'EMAIL_VERIFICATION_PROVIDER_UNAVAILABLE';
        throw error;
      }

      const updateResult = await db.query(
        `UPDATE users
         SET email_verified_at = CURRENT_TIMESTAMP,
             email_verification_token_hash = NULL,
             email_verification_expires_at = NULL
         WHERE user_id = $1 AND email_verification_token_hash = $2
         RETURNING user_id, email, username, full_name, role_id, email_verified_at`,
        [user.user_id, tokenHash]
      );

      if (updateResult.rows.length === 0) {
        const error = new Error('Liên kết xác minh email đã được sử dụng.');
        error.name = 'ValidationError';
        error.status = 400;
        error.code = 'EMAIL_VERIFICATION_INVALID';
        throw error;
      }

      return updateResult.rows[0];
    } catch (error) {
      handleServiceError(error, 'Lỗi xác minh email trong AuthService');
    }
  }

  async resendVerificationEmail(email) {
    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const result = await db.query(
        `SELECT user_id, email, username, full_name, supabase_uid, email_verified_at
         FROM users
         WHERE LOWER(email) = $1`,
        [cleanEmail]
      );

      // Luôn trả cùng một kết quả cho email không tồn tại/đã xác minh để tránh dò tài khoản.
      if (result.rows.length === 0 || result.rows[0].email_verified_at) {
        return true;
      }

      await this.sendVerificationEmail(result.rows[0]);
      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi gửi lại email xác minh trong AuthService');
    }
  }

  async getProfile(userId) {
    try {
      // Lấy thông tin chi tiết người dùng từ database theo cấu trúc mới
      const queryText = 'SELECT user_id, email, username, full_name, birth_date, phone, role_id, gender, created_date, profile_picture_url FROM users WHERE user_id = $1';
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
        createdDate: user.created_date,
        profilePictureUrl: user.profile_picture_url || null,
        isSuperAdmin: isSuperAdminUser(user)
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin cá nhân trong AuthService');
    }
  }

  async changePassword({ userId, oldPassword, newPassword }) {
    try {
      if (!supabaseAdmin || !supabaseClient) {
        throw new Error('Supabase clients chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      // 1. Lấy thông tin user cục bộ
      const queryText = 'SELECT user_id, email, full_name, username, supabase_uid FROM users WHERE user_id = $1';
      const result = await db.query(queryText, [userId]);

      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const user = result.rows[0];
      if (!user.supabase_uid) {
        const error = new Error('Tài khoản chưa được liên kết với Supabase. Hãy đăng xuất và đăng nhập lại.');
        error.name = 'AuthError';
        error.status = 400;
        throw error;
      }

      // 2. Xác thực mật khẩu cũ bằng cách thử đăng nhập Supabase
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password: oldPassword
      });

      if (signInError) {
        const error = new Error('Mật khẩu cũ không chính xác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // 3. Cập nhật mật khẩu mới trên Supabase
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.supabase_uid, {
        password: newPassword
      });

      if (updateError) {
        throw new Error('Không thể cập nhật mật khẩu mới trên Supabase: ' + updateError.message);
      }

      // 4. Gửi email xác nhận thay đổi mật khẩu (bao gồm nội dung an ninh "Nếu đó là bạn")
      try {
        const { sendEmail } = require('../../../utils/email.util');
        const safeDisplayName = escapeHtml(user.full_name || user.username || 'bạn');
        const safeEmail = escapeHtml(user.email);
        const frontendUrl = getFrontendUrl();
        const changeTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #38bdf8; font-size: 24px; font-weight: bold; margin: 0;">E-LEARN ACADEMY</h1>
              <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Hệ thống Học tiếng Anh Thông minh tích hợp AI</p>
            </div>
            <div style="background-color: #1e293b; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
              <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: #10b981; border-radius: 50%; margin-right: 8px;"></span>
                <h2 style="color: #f1f5f9; font-size: 18px; margin: 0;">Xác nhận Thay đổi Mật khẩu Thành công</h2>
              </div>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                Xin chào <strong>${safeDisplayName}</strong>,<br/><br/>
                Mật khẩu cho tài khoản <code>${safeEmail}</code> trên hệ thống E-Learn Academy vừa được cập nhật thành công vào lúc <strong>${changeTime} (giờ Việt Nam)</strong>.
              </p>

              <div style="background-color: rgba(37, 99, 235, 0.12); border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #93c5fd; font-size: 13.5px; font-weight: 600; margin: 0 0 6px 0;">
                  🔒 Nếu đó là bạn:
                </p>
                <p style="color: #e2e8f0; font-size: 13px; line-height: 1.5; margin: 0;">
                  Nếu đó là bạn vừa thực hiện thay đổi này, bạn có thể hoàn toàn yên tâm và bỏ qua email này. Tài khoản của bạn đã được cập nhật và bảo vệ an toàn với mật khẩu mới.
                </p>
              </div>

              <div style="background-color: rgba(239, 68, 68, 0.12); border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
                <p style="color: #fca5a5; font-size: 13.5px; font-weight: 600; margin: 0 0 6px 0;">
                  ⚠️ Nếu KHÔNG phải bạn:
                </p>
                <p style="color: #e2e8f0; font-size: 13px; line-height: 1.5; margin: 0;">
                  Nếu bạn không thực hiện yêu cầu này, tài khoản của bạn có thể đang gặp rủi ro bảo mật. Vui lòng sử dụng tính năng <a href="${frontendUrl}/forgot-password" style="color: #38bdf8; text-decoration: underline;">Quên mật khẩu</a> để đặt lại mật khẩu ngay lập tức hoặc liên hệ với đội ngũ quản trị viên để được hỗ trợ khẩn cấp.
                </p>
              </div>

              <div style="text-align: center; margin: 26px 0 10px;">
                <a href="${frontendUrl}/login" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
                  ĐĂNG NHẬP VỚI MẬT KHẨU MỚI
                </a>
              </div>
            </div>
            <div style="text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 16px;">
              <p>Email này được gửi tự động để bảo đảm an toàn cho tài khoản E-Learn Academy của bạn.</p>
              <p>© 2026 E-Learn Academy. All rights reserved.</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: user.email,
          subject: '[E-Learn Academy] Xác nhận thay đổi mật khẩu tài khoản của bạn',
          text: `Xin chào ${user.full_name || user.username || 'bạn'}, mật khẩu cho tài khoản ${user.email} đã được thay đổi thành công vào lúc ${changeTime}. Nếu đó là bạn, bạn có thể hoàn toàn yên tâm và bỏ qua email này. Nếu KHÔNG phải bạn, vui lòng sử dụng tính năng Quên mật khẩu tại ${frontendUrl}/forgot-password hoặc liên hệ quản trị viên ngay lập tức.`,
          html: emailHtml
        });
      } catch (emailErr) {
        console.error('[Change Password Email Error]:', emailErr);
      }

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

  async uploadAvatar(userId, file) {
    try {
      if (!file || !file.buffer) {
        const error = new Error('Vui lòng chọn tệp hình ảnh để tải lên');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimes.includes(file.mimetype) || !isValidImageBuffer(file.buffer)) {
        const error = new Error('Định dạng hình ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP hoặc GIF');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes || file.buffer.length > maxBytes) {
        const error = new Error('Kích thước ảnh không được vượt quá 5MB');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const rawExt = path.extname(file.originalname || '').toLowerCase();
      const ext = rawExt || (file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : file.mimetype === 'image/gif' ? '.gif' : '.jpg');
      const fileName = `avatar-${userId}-${Date.now()}${ext}`;
      let profilePictureUrl = null;

      // 1. Thử tải lên Supabase Storage bucket 'avatars'
      try {
        if (supabaseAdmin && supabaseAdmin.storage) {
          const { error: uploadErr } = await supabaseAdmin.storage
            .from('avatars')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              upsert: true
            });

          if (!uploadErr) {
            const { data: publicUrlData } = supabaseAdmin.storage
              .from('avatars')
              .getPublicUrl(fileName);
            profilePictureUrl = publicUrlData?.publicUrl || null;
          } else {
            console.warn('[Avatar Upload] Supabase upload failed, falling back to local:', uploadErr.message);
          }
        }
      } catch (storageErr) {
        console.warn('[Avatar Upload] Supabase storage exception:', storageErr.message);
      }

      // 2. Fallback nếu Supabase không khả dụng: Lưu vào uploads/avatars trên server
      if (!profilePictureUrl) {
        const avatarDir = path.join(__dirname, '../../../../uploads/avatars');
        if (!fs.existsSync(avatarDir)) {
          fs.mkdirSync(avatarDir, { recursive: true });
        }
        const localPath = path.join(avatarDir, fileName);
        fs.writeFileSync(localPath, file.buffer);
        profilePictureUrl = `/uploads/avatars/${fileName}`;
      }

      // 3. Cập nhật URL ảnh đại diện vào PostgreSQL
      const updateQuery = `
        UPDATE users 
        SET profile_picture_url = $1 
        WHERE user_id = $2 
        RETURNING user_id, email, username, full_name, birth_date, phone, role_id, gender, created_date, profile_picture_url
      `;
      const result = await db.query(updateQuery, [profilePictureUrl, userId]);
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
        birthDate: updatedUser.birth_date,
        phone: updatedUser.phone,
        roleId: updatedUser.role_id,
        gender: updatedUser.gender,
        createdDate: updatedUser.created_date,
        profilePictureUrl: updatedUser.profile_picture_url,
        isSuperAdmin: isSuperAdminUser(updatedUser)
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi tải ảnh đại diện trong AuthService');
    }
  }

  async syncGoogleUserWithSupabase(email, fullName, profilePictureUrl) {
    if (!supabaseAdmin) {
      console.warn('⚠️ Supabase Admin client chưa cấu hình, bỏ qua đồng bộ Supabase cho user Google');
      return null;
    }
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          profile_picture_url: profilePictureUrl
        }
      });

      if (error) {
        if (error.message.includes('already registered') || error.status === 422) {
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError) {
            const found = listData.users.find(u => u.email === email);
            if (found) {
              if (!found.email_confirmed_at) {
                const { data: confirmedData, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
                  found.id,
                  { email_confirm: true }
                );
                if (confirmError) throw confirmError;
                return confirmedData.user;
              }
              return found;
            }
          }
        }
        throw error;
      }
      return data.user;
    } catch (err) {
      console.error('Lỗi khi sync user Google với Supabase Auth:', err.message);
      return null;
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
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const payload = await response.json();
      if (payload.error_description) {
        const error = new Error(payload.error_description);
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const email = payload.email;
      const fullName = payload.name || payload.given_name || 'Google User';
      const profilePictureUrl = payload.picture || null;

      // Đồng bộ user lên Supabase Auth
      const supabaseUser = await this.syncGoogleUserWithSupabase(email, fullName, profilePictureUrl);

      // Automatically register/update admin emails as Admin (role_id = 1)
      const adminEmails = ['quocanh26012004@gmail.com', 'bte290904@gmail.com'];
      if (adminEmails.includes(email.toLowerCase())) {
        const checkResult = await db.query(
          'SELECT user_id, email, username, full_name, role_id FROM users WHERE email = $1',
          [email]
        );

        if (checkResult.rows.length === 0) {
          let username = email.split('@')[0];
          const checkUsername = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
          if (checkUsername.rows.length > 0) {
            username = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
          }

          const insertQuery = `
            INSERT INTO users (email, password_hash, username, full_name, role_id, profile_picture_url, supabase_uid)
            VALUES ($1, $2, $3, $4, 1, $5, $6)
            RETURNING user_id, email, username, full_name, role_id, profile_picture_url
          `;
          await db.query(insertQuery, [email, '', username, fullName, profilePictureUrl, supabaseUser ? supabaseUser.id : null]);
          console.log(`[Google Auth] Auto-registered admin: ${email}`);
        } else {
          const updateQuery = supabaseUser
            ? 'UPDATE users SET role_id = 1, supabase_uid = $2 WHERE email = $1'
            : 'UPDATE users SET role_id = 1 WHERE email = $1';

          const params = supabaseUser ? [email, supabaseUser.id] : [email];
          await db.query(updateQuery, params);
          console.log(`[Google Auth] Auto-promoted existing user to admin: ${email}`);
        }
      }

      const result = await db.query(
        'SELECT user_id, email, username, full_name, role_id, supabase_uid, email_verified_at FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];

        // Nếu user đã có ở DB cục bộ nhưng chưa lưu supabase_uid, tiến hành cập nhật liên kết
        if (!user.supabase_uid && supabaseUser) {
          await db.query('UPDATE users SET supabase_uid = $1 WHERE user_id = $2', [supabaseUser.id, user.user_id]);
          user.supabase_uid = supabaseUser.id;
        }

        if (!user.email_verified_at) {
          await db.query(
            `UPDATE users
             SET email_verified_at = CURRENT_TIMESTAMP,
                 email_verification_token_hash = NULL,
                 email_verification_expires_at = NULL
             WHERE user_id = $1`,
            [user.user_id]
          );
        }

        const jwtPayload = {
          id: user.user_id,
          email: user.email,
          username: user.username,
          roleId: user.role_id
        };

        const secretKey = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
        const token = jwt.sign(jwtPayload, secretKey, {
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
        profilePictureUrl,
        type: 'google_temp_role_confirm'
      };

      const secretKey = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
      const tempToken = jwt.sign(tempPayload, secretKey, {
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
        if (decoded.type !== 'google_temp_role_confirm') {
          const error = new Error('Liên kết chọn vai trò không hợp lệ');
          error.status = 400;
          throw error;
        }
      } catch (err) {
        if (err.status === 400) throw err;
        const error = new Error('Liên kết chọn vai trò đã hết hạn hoặc không hợp lệ');
        error.status = 400;
        throw error;
      }

      const { email, fullName, profilePictureUrl } = decoded;

      let targetRoleId = parseInt(roleId, 10);
      const adminEmails = ['quocanh26012004@gmail.com', 'bte290904@gmail.com'];
      if (adminEmails.includes(email.toLowerCase())) {
        targetRoleId = 1; // Admin
      } else if (targetRoleId !== 2 && targetRoleId !== 3) {
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

      // Tạo tài khoản trên Supabase Auth
      const supabaseUser = await this.syncGoogleUserWithSupabase(email, fullName, profilePictureUrl);

      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id, profile_picture_url, supabase_uid, email_verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING user_id, email, username, full_name, role_id, profile_picture_url, created_date
      `;
      const values = [email, '', username, fullName, targetRoleId, profilePictureUrl, supabaseUser ? supabaseUser.id : null];
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

  async forgotPassword(email) {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();

      // 1. Kiểm tra tài khoản có tồn tại trong CSDL PostgreSQL hay không
      const userRes = await db.query(
        'SELECT user_id, email, username, full_name, supabase_uid FROM users WHERE LOWER(email) = $1',
        [cleanEmail]
      );

      if (userRes.rows.length === 0) {
        // Trả về true giả lập để tránh dò quét email hệ thống (Security Best Practice)
        return true;
      }

      const user = userRes.rows[0];

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const redirectTo = `${frontendUrl}/reset-password`;
      const providerTimeoutMs = parseTimeout('PASSWORD_RESET_PROVIDER_TIMEOUT_MS', 10000);

      // Tài khoản hiện được đồng bộ với Supabase Auth. Ưu tiên recovery email của
      // Supabase để không phụ thuộc kết nối SMTP outbound của Railway.
      if (user.supabase_uid && supabaseClient?.auth?.resetPasswordForEmail) {
        try {
          const { error: supabaseError } = await withTimeout(
            supabaseClient.auth.resetPasswordForEmail(cleanEmail, { redirectTo }),
            providerTimeoutMs,
            'Supabase password recovery'
          );

          if (!supabaseError) {
            return true;
          }

          console.warn('[Password Reset]: Supabase recovery thất bại, chuyển sang SMTP fallback:', supabaseError.message);
        } catch (supabaseError) {
          console.warn('[Password Reset]: Supabase recovery timeout/lỗi, chuyển sang SMTP fallback:', supabaseError.message);
        }
      }

      // SMTP chỉ là fallback cho tài khoản cũ hoặc khi Supabase tạm thời lỗi.
      const resetToken = jwt.sign(
        { id: user.user_id, email: user.email, supabaseUid: user.supabase_uid, type: 'reset_password' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const resetLink = `${frontendUrl}/reset-password?access_token=${resetToken}`;

      const { sendEmail } = require('../../../utils/email.util');
      const safeDisplayName = escapeHtml(user.full_name || user.username || 'bạn');
      const safeEmail = escapeHtml(user.email);
      const safeResetLink = escapeHtml(resetLink);
      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #38bdf8; font-size: 24px; font-weight: bold; margin: 0;">E-LEARN ACADEMY</h1>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Hệ thống Học tiếng Anh Thông minh tích hợp AI</p>
          </div>
          <div style="background-color: #1e293b; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
            <h2 style="color: #f1f5f9; font-size: 18px; margin-top: 0;">Khôi phục Mật khẩu Tài khoản</h2>
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              Xin chào <strong>${safeDisplayName}</strong>,<br/><br/>
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <code>${safeEmail}</code>. Nhấp vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${safeResetLink}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
                ĐẶT LẠI MẬT KHẨU NGAY
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
              Hoặc bạn có thể sao chép liên kết sau dán vào trình duyệt:<br/>
              <a href="${safeResetLink}" style="color: #38bdf8; word-break: break-all;">${safeResetLink}</a>
            </p>
          </div>
          <div style="text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 16px;">
            <p>Liên kết này có hiệu lực trong 60 phút. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email.</p>
            <p>© 2026 E-Learn Academy. All rights reserved.</p>
          </div>
        </div>
      `;

      const emailSent = await sendEmail({
        to: user.email,
        subject: '[E-Learn Academy] Khôi phục Mật khẩu Tài khoản của bạn',
        html: emailHtml
      });

      if (!emailSent) {
        // Giữ response chung để không biến endpoint thành công cụ dò email.
        // Lỗi chi tiết chỉ xuất hiện trong server log/monitoring.
        console.error(`[Password Reset]: Không nhà cung cấp email nào nhận yêu cầu cho user_id=${user.user_id}`);
      }

      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi gửi yêu cầu khôi phục mật khẩu trong AuthService');
    }
  }

  async resetPassword({ accessToken, newPassword }) {
    try {
      if (!accessToken) {
        const error = new Error('Mã xác thực không hợp lệ');
        error.status = 400;
        throw error;
      }

      // 1. Giải mã JWT resetToken
      let decoded;
      try {
        decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        if (decoded.type !== 'reset_password') {
          const error = new Error('Mã xác thực không hợp lệ cho yêu cầu đặt lại mật khẩu');
          error.status = 400;
          throw error;
        }
      } catch (err) {
        if (err.status === 400) throw err;
        // Fallback thử với Supabase client nếu là token Supabase
        if (supabaseClient && supabaseAdmin) {
          const { data: { user }, error: userError } = await withTimeout(
            supabaseClient.auth.getUser(accessToken),
            parseTimeout('PASSWORD_RESET_PROVIDER_TIMEOUT_MS', 10000),
            'Supabase recovery token validation'
          );
          if (!userError && user) {
            decoded = { id: user.id, email: user.email, supabaseUid: user.id };
          }
        }
      }

      if (!decoded) {
        const error = new Error('Token khôi phục không hợp lệ hoặc đã hết hạn');
        error.status = 400;
        throw error;
      }

      // 2. Mã hóa mật khẩu mới bằng bcryptjs
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // 3. Cập nhật mật khẩu mới vào PostgreSQL
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE user_id = $2 OR LOWER(email) = $3',
        [hashedPassword, decoded.id || 0, (decoded.email || '').toLowerCase()]
      );

      // 4. Đồng bộ mật khẩu mới sang Supabase Auth nếu có supabaseAdmin
      if (supabaseAdmin && decoded.supabaseUid) {
        try {
          await withTimeout(
            supabaseAdmin.auth.admin.updateUserById(decoded.supabaseUid, {
              password: newPassword
            }),
            parseTimeout('PASSWORD_RESET_PROVIDER_TIMEOUT_MS', 10000),
            'Supabase password synchronization'
          );
        } catch (sErr) {
          console.warn('[Supabase Sync Warning]: Không thể sync pass sang Supabase Auth:', sErr.message);
        }
      }

      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi đặt lại mật khẩu mới trong AuthService');
    }
  }

  /**
   * Lấy thống kê học tập của user (dùng cho Profile Page)
   * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
   */
  async getUserStats(userId) {
    const client = typeof db.getClient === 'function' ? await db.getClient() : await db.pool.connect();
    try {
      // 1. Số khóa học đã có tiến trình
      const enrolledResult = await client.query(`
        SELECT COUNT(DISTINCT c.course_id) AS enrolled_courses
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.lesson_id
        JOIN sections s ON l.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE up.user_id = $1
      `, [userId]);

      // 2. Số bài học đã hoàn thành
      const completedResult = await client.query(`
        SELECT COUNT(*) AS completed_lessons
        FROM user_progress
        WHERE user_id = $1 AND is_completed = TRUE
      `, [userId]);

      // 3. Tổng số lượt chat AI
      const chatResult = await client.query(`
        SELECT COUNT(*) AS ai_chat_count
        FROM ai_chat
        WHERE student_id = $1
      `, [userId]);

      // 4. Tiến trình trung bình (% bài hoàn thành / tổng bài trong các khóa đã tham gia)
      const totalLessonsResult = await client.query(`
        SELECT COUNT(DISTINCT l.lesson_id) AS total_lessons
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        WHERE s.course_id IN (
          SELECT DISTINCT c2.course_id
          FROM user_progress up2
          JOIN lessons l2 ON up2.lesson_id = l2.lesson_id
          JOIN sections s2 ON l2.section_id = s2.section_id
          JOIN courses c2 ON s2.course_id = c2.course_id
          WHERE up2.user_id = $1
        )
      `, [userId]);

      const enrolledCourses = parseInt(enrolledResult.rows[0]?.enrolled_courses || 0, 10);
      const completedLessons = parseInt(completedResult.rows[0]?.completed_lessons || 0, 10);
      const aiChatCount = parseInt(chatResult.rows[0]?.ai_chat_count || 0, 10);
      const totalLessons = parseInt(totalLessonsResult.rows[0]?.total_lessons || 0, 10);
      const avgProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return { enrolledCourses, completedLessons, aiChatCount, avgProgress };
    } finally {
      client.release();
    }
  }
}

module.exports = new AuthService();
