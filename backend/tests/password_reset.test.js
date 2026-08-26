const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');
const { supabaseClient } = require('../src/config/supabase');
const emailUtil = require('../src/utils/email.util');

describe('Password reset delivery regression', () => {
  const originalQuery = db.query;
  const originalSupabaseReset = supabaseClient.auth.resetPasswordForEmail;
  const originalSendEmail = emailUtil.sendEmail;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'password-reset-test-secret';
  });

  after(() => {
    db.query = originalQuery;
    supabaseClient.auth.resetPasswordForEmail = originalSupabaseReset;
    emailUtil.sendEmail = originalSendEmail;
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('uses Supabase recovery first and does not send a duplicate SMTP email', async () => {
    db.query = async () => ({
      rows: [{
        user_id: 18,
        email: 'student@example.com',
        username: 'student',
        full_name: 'Student',
        supabase_uid: 'supabase-user-18'
      }]
    });

    let redirectTo;
    let smtpCalls = 0;
    supabaseClient.auth.resetPasswordForEmail = async (_email, options) => {
      redirectTo = options.redirectTo;
      return { data: {}, error: null };
    };
    emailUtil.sendEmail = async () => {
      smtpCalls += 1;
      return true;
    };

    const result = await authService.forgotPassword(' STUDENT@example.com ');

    assert.strictEqual(result, true);
    assert.match(redirectTo, /\/reset-password$/);
    assert.strictEqual(smtpCalls, 0);
  });

  it('falls back to bounded SMTP delivery when Supabase rejects the request', async () => {
    db.query = async () => ({
      rows: [{
        user_id: 19,
        email: 'legacy@example.com',
        username: 'legacy',
        full_name: '<Legacy User>',
        supabase_uid: 'supabase-user-19'
      }]
    });

    supabaseClient.auth.resetPasswordForEmail = async () => ({
      data: null,
      error: new Error('provider unavailable')
    });

    let smtpMessage;
    emailUtil.sendEmail = async (message) => {
      smtpMessage = message;
      return true;
    };

    const result = await authService.forgotPassword('legacy@example.com');

    assert.strictEqual(result, true);
    assert.strictEqual(smtpMessage.to, 'legacy@example.com');
    assert.match(smtpMessage.html, /access_token=/);
    assert.doesNotMatch(smtpMessage.html, /<Legacy User>/);
    assert.match(smtpMessage.html, /&lt;Legacy User&gt;/);
  });

  it('does not call any delivery provider for an unknown email', async () => {
    db.query = async () => ({ rows: [] });
    let providerCalls = 0;
    supabaseClient.auth.resetPasswordForEmail = async () => {
      providerCalls += 1;
      return { data: {}, error: null };
    };
    emailUtil.sendEmail = async () => {
      providerCalls += 1;
      return true;
    };

    const result = await authService.forgotPassword('missing@example.invalid');

    assert.strictEqual(result, true);
    assert.strictEqual(providerCalls, 0);
  });

  it('hard-stops a stalled SMTP send instead of leaving the HTTP request hanging', async () => {
    const stalledTransporter = {
      sendMail: () => new Promise(() => {})
    };
    const startedAt = Date.now();

    await assert.rejects(
      emailUtil.sendMailWithTimeout(stalledTransporter, {}, 25),
      (error) => error.code === 'SMTP_SEND_TIMEOUT'
    );

    assert.ok(Date.now() - startedAt < 500);
  });
});
