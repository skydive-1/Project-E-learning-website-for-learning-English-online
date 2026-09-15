'use strict';

const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');
const { supabaseAdmin, supabaseClient } = require('../src/config/supabase');

const LOCAL_PASSWORD = 'LocalPass123!';
const localHash = bcrypt.hashSync(LOCAL_PASSWORD, 4);
const localRow = {
  user_id: 99,
  email: 'legacy.user@example.com',
  password_hash: localHash,
  username: 'legacyuser',
  full_name: 'Legacy User',
  role_id: 3,
  supabase_uid: null,
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
  profile_picture_url: null
};

describe('Lazy migration email conflict', () => {
  const originalQuery = db.query;
  const originalSignIn = supabaseClient.auth.signInWithPassword;
  const originalCreateUser = supabaseAdmin.auth.admin.createUser;
  const originalListUsers = supabaseAdmin.auth.admin.listUsers;
  const originalUpdateUserById = supabaseAdmin.auth.admin.updateUserById;
  const originalJwtSecret = process.env.JWT_SECRET;
  let updates = [];

  before(() => {
    process.env.JWT_SECRET = 'lazy-migration-conflict-test-secret';
  });

  after(() => {
    db.query = originalQuery;
    supabaseClient.auth.signInWithPassword = originalSignIn;
    supabaseAdmin.auth.admin.createUser = originalCreateUser;
    supabaseAdmin.auth.admin.listUsers = originalListUsers;
    supabaseAdmin.auth.admin.updateUserById = originalUpdateUserById;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  const stubDb = ({ listUsersResult }) => {
    updates = [];
    supabaseClient.auth.signInWithPassword = async () => ({
      data: { user: null },
      error: { message: 'Invalid login credentials' }
    });
    supabaseAdmin.auth.admin.createUser = async () => ({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered', status: 422 }
    });
    supabaseAdmin.auth.admin.listUsers = async () => listUsersResult;
    supabaseAdmin.auth.admin.updateUserById = async (id, payload) => {
      updates.push({ id, payload });
      return { data: {}, error: null };
    };
    db.query = async (sql, params) => {
      if (/FROM users WHERE LOWER\(email\) = \$1/i.test(sql) && !/password_hash/i.test(sql)) {
        return { rows: [{ user_id: localRow.user_id, email_verified_at: localRow.email_verified_at }] };
      }
      if (/SELECT user_id, email, password_hash/i.test(sql)) {
        return { rows: [{ ...localRow }] };
      }
      if (/UPDATE users SET supabase_uid/i.test(sql)) {
        updates.push({ sql, params });
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    };
  };

  it('link UID sẵn có và đồng bộ password khi local đúng nhưng Supabase đã tồn tại', async () => {
    stubDb({
      listUsersResult: {
        data: { users: [{ id: 'supa-existing-1', email: localRow.email }] },
        error: null
      }
    });

    const result = await authService.login({ email: localRow.email, password: LOCAL_PASSWORD });

    assert.ok(result.token);
    assert.strictEqual(result.user.email, localRow.email);
    const passwordSync = updates.find(entry => entry.payload && entry.payload.password === LOCAL_PASSWORD);
    assert.ok(passwordSync);
    assert.strictEqual(passwordSync.id, 'supa-existing-1');
    const uidLink = updates.find(entry => Array.isArray(entry.params) && entry.params[0] === 'supa-existing-1');
    assert.ok(uidLink);
  });

  it('vẫn trả 401 khi Supabase không tìm thấy user trùng để link', async () => {
    stubDb({
      listUsersResult: { data: { users: [] }, error: null }
    });

    await assert.rejects(
      () => authService.login({ email: localRow.email, password: LOCAL_PASSWORD }),
      /Email hoặc mật khẩu không chính xác/
    );
  });

  it('sai mật khẩu local thì không chạm Supabase admin', async () => {
    let adminTouched = false;
    supabaseClient.auth.signInWithPassword = async () => ({
      data: { user: null },
      error: { message: 'Invalid login credentials' }
    });
    supabaseAdmin.auth.admin.createUser = async () => {
      adminTouched = true;
      throw new Error('must not create when local password is wrong');
    };
    db.query = async (sql) => {
      if (/FROM users WHERE LOWER\(email\) = \$1/i.test(sql) && !/password_hash/i.test(sql)) {
        return { rows: [{ user_id: localRow.user_id, email_verified_at: localRow.email_verified_at }] };
      }
      if (/SELECT user_id, email, password_hash/i.test(sql)) {
        return { rows: [{ ...localRow }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    };

    await assert.rejects(
      () => authService.login({ email: localRow.email, password: 'WrongPass999!' }),
      /Email hoặc mật khẩu không chính xác/
    );
    assert.strictEqual(adminTouched, false);
  });
});
