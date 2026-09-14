'use strict';

const { after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');
const { supabaseAdmin, supabaseClient } = require('../src/config/supabase');
const emailUtil = require('../src/utils/email.util');

const TEST_ACCOUNT_PASSWORD = crypto.randomBytes(24).toString('base64url');

describe('Email verification flow', () => {
  const originalQuery = db.query;
  const originalCreateUser = supabaseAdmin.auth.admin.createUser;
  const originalUpdateUserById = supabaseAdmin.auth.admin.updateUserById;
  const originalSignIn = supabaseClient.auth.signInWithPassword;
  const originalSendEmail = emailUtil.sendEmail;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://elearn.example.com';
  });

  after(() => {
    db.query = originalQuery;
    supabaseAdmin.auth.admin.createUser = originalCreateUser;
    supabaseAdmin.auth.admin.updateUserById = originalUpdateUserById;
    supabaseClient.auth.signInWithPassword = originalSignIn;
    emailUtil.sendEmail = originalSendEmail;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('creates password accounts as unverified and never stores the raw email token', async () => {
    let createPayload;
    let storedTokenHash;
    let sentMessage;

    supabaseAdmin.auth.admin.createUser = async (payload) => {
      createPayload = payload;
      return { data: { user: { id: 'supabase-42' } }, error: null };
    };
    emailUtil.sendEmail = async (message) => {
      sentMessage = message;
      return true;
    };
    db.query = async (sql, params = []) => {
      if (/SELECT user_id FROM users WHERE LOWER\(email\)/i.test(sql)) return { rows: [] };
      if (/SELECT user_id FROM users WHERE username/i.test(sql)) return { rows: [] };
      if (/INSERT INTO users/i.test(sql)) {
        return {
          rows: [{
            user_id: 42,
            email: 'student@gmail.com',
            username: 'student',
            full_name: 'Student',
            role_id: 3,
            created_date: new Date('2026-09-14T00:00:00Z'),
            supabase_uid: 'supabase-42'
          }]
        };
      }
      if (/email_verification_token_hash = \$1/i.test(sql)) {
        [storedTokenHash] = params;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    };

    const result = await authService.register({
      email: ' STUDENT@gmail.com ',
      username: 'student',
      password: TEST_ACCOUNT_PASSWORD,
      roleId: 3
    });

    assert.equal(createPayload.email, 'student@gmail.com');
    assert.equal(createPayload.email_confirm, false);
    assert.equal(result.requiresEmailVerification, true);
    assert.equal(result.emailDeliveryAccepted, true);
    assert.match(storedTokenHash, /^[a-f0-9]{64}$/);

    const rawToken = sentMessage.html.match(/token=([a-f0-9]{64})/i)?.[1];
    assert.ok(rawToken, 'email must contain a 64-character one-time token');
    assert.notEqual(rawToken, storedTokenHash);
    assert.equal(
      crypto.createHash('sha256').update(rawToken).digest('hex'),
      storedTokenHash
    );
  });

  it('blocks password login before email verification', async () => {
    let signInCalls = 0;
    db.query = async () => ({
      rows: [{ user_id: 7, email_verified_at: null }]
    });
    supabaseClient.auth.signInWithPassword = async () => {
      signInCalls += 1;
      return { data: null, error: null };
    };

    await assert.rejects(
      authService.login({ email: 'pending@gmail.com', password: TEST_ACCOUNT_PASSWORD }),
      (error) => error.code === 'EMAIL_NOT_VERIFIED' && error.status === 403
    );
    assert.equal(signInCalls, 0);
  });

  it('confirms Supabase and consumes a valid token exactly once', async () => {
    const rawToken = 'a'.repeat(64);
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    let providerUpdate;
    let consumedHash;

    supabaseAdmin.auth.admin.updateUserById = async (userId, payload) => {
      providerUpdate = { userId, payload };
      return { data: { user: { id: userId } }, error: null };
    };
    db.query = async (sql, params = []) => {
      if (/FROM users\s+WHERE email_verification_token_hash/i.test(sql)) {
        assert.equal(params[0], expectedHash);
        return {
          rows: [{
            user_id: 8,
            email: 'verified@gmail.com',
            username: 'verified',
            full_name: 'Verified User',
            supabase_uid: 'supabase-8',
            email_verified_at: null,
            email_verification_expires_at: new Date(Date.now() + 60_000)
          }]
        };
      }
      if (/UPDATE users\s+SET email_verified_at/i.test(sql)) {
        consumedHash = params[1];
        return {
          rows: [{
            user_id: 8,
            email: 'verified@gmail.com',
            username: 'verified',
            full_name: 'Verified User',
            role_id: 3,
            email_verified_at: new Date()
          }]
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    };

    const verified = await authService.verifyEmail(rawToken);

    assert.deepEqual(providerUpdate, {
      userId: 'supabase-8',
      payload: { email_confirm: true }
    });
    assert.equal(consumedHash, expectedHash);
    assert.equal(verified.email, 'verified@gmail.com');
  });

  it('does not reveal or email an unknown address during resend', async () => {
    let sendCalls = 0;
    db.query = async () => ({ rows: [] });
    emailUtil.sendEmail = async () => {
      sendCalls += 1;
      return true;
    };

    const accepted = await authService.resendVerificationEmail('missing@gmail.com');

    assert.equal(accepted, true);
    assert.equal(sendCalls, 0);
  });

  it('rejects an expired token before contacting Supabase', async () => {
    const rawToken = 'b'.repeat(64);
    let providerCalls = 0;
    db.query = async () => ({
      rows: [{
        user_id: 9,
        email: 'expired@gmail.com',
        supabase_uid: 'supabase-9',
        email_verification_expires_at: new Date(Date.now() - 1_000)
      }]
    });
    supabaseAdmin.auth.admin.updateUserById = async () => {
      providerCalls += 1;
      return { data: null, error: null };
    };

    await assert.rejects(
      authService.verifyEmail(rawToken),
      (error) => error.code === 'EMAIL_VERIFICATION_EXPIRED'
    );
    assert.equal(providerCalls, 0);
  });
});
