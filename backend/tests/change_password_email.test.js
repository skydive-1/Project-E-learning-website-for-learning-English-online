const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');
const { supabaseClient, supabaseAdmin } = require('../src/config/supabase');
const emailUtil = require('../src/utils/email.util');

describe('Change password security email notification suite', () => {
  const originalQuery = db.query;
  const originalSignIn = supabaseClient.auth.signInWithPassword;
  const originalUpdateUser = supabaseAdmin.auth.admin.updateUserById;
  const originalSendEmail = emailUtil.sendEmail;

  beforeEach(() => {
    // Reset mocks before each test
  });

  after(() => {
    db.query = originalQuery;
    supabaseClient.auth.signInWithPassword = originalSignIn;
    supabaseAdmin.auth.admin.updateUserById = originalUpdateUser;
    emailUtil.sendEmail = originalSendEmail;
  });

  it('sends confirmation email with "Nếu đó là bạn" security line when password is changed successfully', async () => {
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
      return { rows: [] };
    };

    supabaseClient.auth.signInWithPassword = async ({ email, password }) => {
      assert.strictEqual(email, 'quocanh@example.com');
      assert.strictEqual(password, 'OldPassword123!');
      return { data: { session: {} }, error: null };
    };

    supabaseAdmin.auth.admin.updateUserById = async (uid, attributes) => {
      assert.strictEqual(uid, 'supabase-uid-4');
      assert.strictEqual(attributes.password, 'NewSecurePassword456!');
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
      newPassword: 'NewSecurePassword456!'
    });

    assert.strictEqual(result, true, 'changePassword must return true');
    assert.ok(sentEmailPayload, 'sendEmail must be called');
    assert.strictEqual(sentEmailPayload.to, 'quocanh@example.com');
    assert.match(sentEmailPayload.subject, /Xác nhận thay đổi mật khẩu/i);
    assert.ok(
      sentEmailPayload.html.includes('Nếu đó là bạn'),
      'HTML email must contain the required security sentence "Nếu đó là bạn"'
    );
    assert.ok(
      sentEmailPayload.html.includes('Nếu KHÔNG phải bạn'),
      'HTML email must contain warning "Nếu KHÔNG phải bạn"'
    );
    assert.ok(
      sentEmailPayload.text.includes('Nếu đó là bạn'),
      'Plain text email must also contain "Nếu đó là bạn"'
    );
  });

  it('does not send email if old password validation fails', async () => {
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
      return { data: null, error: { message: 'Invalid login credentials' } };
    };

    let emailCalled = false;
    emailUtil.sendEmail = async () => {
      emailCalled = true;
      return true;
    };

    await assert.rejects(
      async () => {
        await authService.changePassword({
          userId: 4,
          oldPassword: 'WrongOldPassword',
          newPassword: 'NewSecurePassword456!'
        });
      },
      (err) => {
        assert.match(err.message, /Mật khẩu cũ không chính xác/i);
        return true;
      }
    );

    assert.strictEqual(emailCalled, false, 'sendEmail must not be called when validation fails');
  });

  it('degrades gracefully if email delivery encounters an unexpected error', async () => {
    db.query = async () => ({
      rows: [{
        user_id: 4,
        email: 'quocanh@example.com',
        full_name: 'Nguyễn Dũng Quốc Anh',
        username: 'quocanh',
        supabase_uid: 'supabase-uid-4'
      }]
    });

    supabaseClient.auth.signInWithPassword = async () => ({ data: {}, error: null });
    supabaseAdmin.auth.admin.updateUserById = async () => ({ data: {}, error: null });

    emailUtil.sendEmail = async () => {
      throw new Error('SMTP connection timed out');
    };

    // Even if sending email throws, changePassword must still complete successfully
    const result = await authService.changePassword({
      userId: 4,
      oldPassword: 'OldPassword123!',
      newPassword: 'NewSecurePassword456!'
    });

    assert.strictEqual(result, true);
  });
});
