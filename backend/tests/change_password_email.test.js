const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');
const { supabaseClient, supabaseAdmin } = require('../src/config/supabase');
const emailUtil = require('../src/utils/email.util');

describe('Change password 2-step OTP verification and email suite', () => {
  const originalQuery = db.query;
  const originalSignIn = supabaseClient.auth.signInWithPassword;
  const originalUpdateUser = supabaseAdmin.auth.admin.updateUserById;
  const originalSendEmail = emailUtil.sendEmail;

  after(() => {
    db.query = originalQuery;
    supabaseClient.auth.signInWithPassword = originalSignIn;
    supabaseAdmin.auth.admin.updateUserById = originalUpdateUser;
    emailUtil.sendEmail = originalSendEmail;
  });

  describe('requestPasswordChangeOtp', () => {
    it('generates 6-digit OTP, saves hash to DB, and sends OTP email with "Nếu đó là bạn"', async () => {
      let savedOtpHash = null;
      let savedExpiresAt = null;

      db.query = async (sql, params) => {
        if (sql.includes('SELECT user_id, email, full_name, username, supabase_uid FROM users')) {
          return {
            rows: [{
              user_id: 4,
              email: 'quocanh@example.com',
              full_name: 'Nguyễn Dũng Quốc Anh',
              username: 'quocanh',
              supabase_uid: 'supabase-uid-4'
            }]
          };
        }
        if (sql.includes('UPDATE users') && sql.includes('password_change_otp_hash')) {
          savedOtpHash = params[0];
          savedExpiresAt = params[1];
          return { rowCount: 1 };
        }
        return { rows: [] };
      };

      supabaseClient.auth.signInWithPassword = async ({ email, password }) => {
        assert.strictEqual(email, 'quocanh@example.com');
        assert.strictEqual(password, 'OldPassword123!');
        return { data: { session: {} }, error: null };
      };

      let sentEmail = null;
      emailUtil.sendEmail = async (payload) => {
        sentEmail = payload;
        return true;
      };

      const result = await authService.requestPasswordChangeOtp({
        userId: 4,
        oldPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword456!'
      });

      assert.strictEqual(result.success, true);
      assert.ok(savedOtpHash, 'Must have saved hashed OTP to database');
      assert.strictEqual(savedOtpHash.length, 64, 'SHA-256 hash length is 64 hex characters');
      assert.ok(savedExpiresAt > new Date(), 'Expiry must be in the future');

      assert.ok(sentEmail, 'OTP email must be sent');
      assert.strictEqual(sentEmail.to, 'quocanh@example.com');
      assert.match(sentEmail.subject, /Mã OTP xác thực đổi mật khẩu/i);
      assert.ok(sentEmail.html.includes('Nếu đó là bạn'), 'Must contain "Nếu đó là bạn"');
      assert.ok(sentEmail.html.includes('Nếu KHÔNG phải bạn'), 'Must contain "Nếu KHÔNG phải bạn"');
    });

    it('rejects OTP request when old password is wrong and does not send email', async () => {
      db.query = async () => ({
        rows: [{
          user_id: 4,
          email: 'quocanh@example.com',
          full_name: 'Nguyễn Dũng Quốc Anh',
          username: 'quocanh',
          supabase_uid: 'supabase-uid-4'
        }]
      });

      supabaseClient.auth.signInWithPassword = async () => {
        return { data: null, error: { message: 'Invalid credentials' } };
      };

      let emailSent = false;
      emailUtil.sendEmail = async () => {
        emailSent = true;
        return true;
      };

      await assert.rejects(
        async () => {
          await authService.requestPasswordChangeOtp({
            userId: 4,
            oldPassword: 'WrongPassword!',
            newPassword: 'NewSecurePassword456!'
          });
        },
        (err) => {
          assert.match(err.message, /Mật khẩu cũ không chính xác/i);
          return true;
        }
      );

      assert.strictEqual(emailSent, false);
    });

    it('rejects OTP request when new password is same as old password', async () => {
      await assert.rejects(
        async () => {
          await authService.requestPasswordChangeOtp({
            userId: 4,
            oldPassword: 'SamePassword123!',
            newPassword: 'SamePassword123!'
          });
        },
        (err) => {
          assert.match(err.message, /Mật khẩu mới không được trùng/i);
          return true;
        }
      );
    });
  });

  describe('changePassword with OTP', () => {
    it('successfully changes password when OTP is valid, clears OTP in DB, and sends confirmation email', async () => {
      const validOtp = '654321';
      const validHash = crypto.createHash('sha256').update(validOtp).digest('hex');
      let clearedOtp = false;

      db.query = async (sql, params) => {
        if (sql.includes('SELECT user_id, email, full_name, username, supabase_uid')) {
          return {
            rows: [{
              user_id: 4,
              email: 'quocanh@example.com',
              full_name: 'Nguyễn Dũng Quốc Anh',
              username: 'quocanh',
              supabase_uid: 'supabase-uid-4',
              password_change_otp_hash: validHash,
              password_change_otp_expires_at: new Date(Date.now() + 4 * 60 * 1000)
            }]
          };
        }
        if (sql.includes('UPDATE users SET password_change_otp_hash = NULL')) {
          clearedOtp = true;
          return { rowCount: 1 };
        }
        return { rows: [] };
      };

      supabaseClient.auth.signInWithPassword = async () => ({ data: { session: {} }, error: null });
      supabaseAdmin.auth.admin.updateUserById = async (uid, attrs) => {
        assert.strictEqual(uid, 'supabase-uid-4');
        assert.strictEqual(attrs.password, 'NewSecurePassword456!');
        return { data: { user: {} }, error: null };
      };

      let sentEmailPayload = null;
      emailUtil.sendEmail = async (payload) => {
        sentEmailPayload = payload;
        return true;
      };

      const result = await authService.changePassword({
        userId: 4,
        oldPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword456!',
        otp: validOtp
      });

      assert.strictEqual(result, true);
      assert.strictEqual(clearedOtp, true, 'OTP hash must be cleared after successful password change');
      assert.ok(sentEmailPayload);
      assert.match(sentEmailPayload.subject, /Xác nhận thay đổi mật khẩu/i);
      assert.ok(sentEmailPayload.html.includes('Nếu đó là bạn'));
      assert.ok(sentEmailPayload.html.includes('Nếu KHÔNG phải bạn'));
    });

    it('rejects when OTP is invalid', async () => {
      const validHash = crypto.createHash('sha256').update('654321').digest('hex');

      db.query = async () => ({
        rows: [{
          user_id: 4,
          email: 'quocanh@example.com',
          full_name: 'Nguyễn Dũng Quốc Anh',
          username: 'quocanh',
          supabase_uid: 'supabase-uid-4',
          password_change_otp_hash: validHash,
          password_change_otp_expires_at: new Date(Date.now() + 4 * 60 * 1000)
        }]
      });

      await assert.rejects(
        async () => {
          await authService.changePassword({
            userId: 4,
            oldPassword: 'OldPassword123!',
            newPassword: 'NewSecurePassword456!',
            otp: '000000' // Wrong OTP
          });
        },
        (err) => {
          assert.match(err.message, /Mã xác thực OTP không chính xác/i);
          return true;
        }
      );
    });

    it('rejects when OTP has expired', async () => {
      const validHash = crypto.createHash('sha256').update('654321').digest('hex');

      db.query = async (sql) => {
        if (sql.includes('SELECT')) {
          return {
            rows: [{
              user_id: 4,
              email: 'quocanh@example.com',
              full_name: 'Nguyễn Dũng Quốc Anh',
              username: 'quocanh',
              supabase_uid: 'supabase-uid-4',
              password_change_otp_hash: validHash,
              password_change_otp_expires_at: new Date(Date.now() - 1000) // Expired!
            }]
          };
        }
        return { rowCount: 1 };
      };

      await assert.rejects(
        async () => {
          await authService.changePassword({
            userId: 4,
            oldPassword: 'OldPassword123!',
            newPassword: 'NewSecurePassword456!',
            otp: '654321'
          });
        },
        (err) => {
          assert.match(err.message, /Mã xác thực OTP đã hết hạn/i);
          return true;
        }
      );
    });

    it('rejects when OTP has not been requested', async () => {
      db.query = async () => ({
        rows: [{
          user_id: 4,
          email: 'quocanh@example.com',
          full_name: 'Nguyễn Dũng Quốc Anh',
          username: 'quocanh',
          supabase_uid: 'supabase-uid-4',
          password_change_otp_hash: null,
          password_change_otp_expires_at: null
        }]
      });

      await assert.rejects(
        async () => {
          await authService.changePassword({
            userId: 4,
            oldPassword: 'OldPassword123!',
            newPassword: 'NewSecurePassword456!',
            otp: '654321'
          });
        },
        (err) => {
          assert.match(err.message, /Chưa có mã OTP nào được yêu cầu/i);
          return true;
        }
      );
    });
  });
});
