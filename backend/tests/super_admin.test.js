const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const adminController = require('../src/modules/admin/controllers/admin.controller');
const adminService = require('../src/modules/admin/services/admin.service');
const authService = require('../src/modules/auth/services/auth.service');
const { isSuperAdminUser } = require('../src/utils/superAdmin.util');

const owner = {
  user_id: 18,
  email: 'owner@example.com',
  username: 'owner',
  full_name: 'Owner',
  role_id: 1,
  created_date: new Date()
};

const regularAdmin = { id: 20, email: 'admin@example.com', roleId: 1 };

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; }
});

const invoke = async (handler, req) => {
  const res = createResponse();
  let forwardedError;
  await handler(req, res, (error) => { forwardedError = error; });
  return { res, error: forwardedError };
};

describe('Super Admin ownership boundary', () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAILS;
  const originalQuery = db.query;
  const originalGetAllUsers = adminService.getAllUsers;
  const originalUpdateUserRole = adminService.updateUserRole;
  const originalDeleteUser = adminService.deleteUser;
  const originalResetUserToken = adminService.resetUserToken;

  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAILS = 'owner@example.com';
    db.query = originalQuery;
    adminService.getAllUsers = originalGetAllUsers;
    adminService.updateUserRole = originalUpdateUserRole;
    adminService.deleteUser = originalDeleteUser;
    adminService.resetUserToken = originalResetUserToken;
  });

  after(() => {
    if (originalEnv === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = originalEnv;
    db.query = originalQuery;
    adminService.getAllUsers = originalGetAllUsers;
    adminService.updateUserRole = originalUpdateUserRole;
    adminService.deleteUser = originalDeleteUser;
    adminService.resetUserToken = originalResetUserToken;
  });

  it('requires both the configured email and role_id=1', () => {
    assert.strictEqual(isSuperAdminUser(owner), true);
    assert.strictEqual(isSuperAdminUser({ ...owner, role_id: 3 }), false);
    assert.strictEqual(isSuperAdminUser({ ...owner, email: 'other@example.com' }), false);
  });

  it('returns the authoritative Super Admin flag in the auth profile', async () => {
    db.query = async () => ({ rows: [owner] });
    const profile = await authService.getProfile(owner.user_id);
    assert.strictEqual(profile.isSuperAdmin, true);
  });

  it('marks the protected account in the admin user list', async () => {
    adminService.getAllUsers = async () => [owner, { ...owner, user_id: 21, email: 'admin@example.com' }];
    const { res, error } = await invoke(adminController.getAllUsers, {});
    assert.strictEqual(error, undefined);
    assert.strictEqual(res.payload.users[0].is_super_admin, true);
    assert.strictEqual(res.payload.users[1].is_super_admin, false);
  });

  it('blocks a regular Admin from granting the Admin role', async () => {
    db.query = async () => ({ rows: [{ user_id: 30, email: 'student@example.com', role_id: 3 }] });
    adminService.updateUserRole = async () => { throw new Error('service must not be called'); };
    const { error } = await invoke(adminController.updateUserRole, {
      params: { userId: '30' }, body: { roleId: 1 }, user: regularAdmin
    });
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.code, 'SUPER_ADMIN_REQUIRED');
  });

  it('allows the owner to grant Admin role to another account', async () => {
    db.query = async () => ({ rows: [{ user_id: 30, email: 'student@example.com', role_id: 3 }] });
    adminService.updateUserRole = async (userId, roleId) => ({ user_id: Number(userId), role_id: roleId });
    const { res, error } = await invoke(adminController.updateUserRole, {
      params: { userId: '30' },
      body: { roleId: 1 },
      user: { id: owner.user_id, email: owner.email, roleId: owner.role_id }
    });
    assert.strictEqual(error, undefined);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.user.role_id, 1);
  });

  it('prevents every Admin from demoting or deleting the owner account', async () => {
    db.query = async () => ({ rows: [owner] });
    adminService.updateUserRole = async () => { throw new Error('service must not be called'); };
    adminService.deleteUser = async () => { throw new Error('service must not be called'); };

    const demote = await invoke(adminController.updateUserRole, {
      params: { userId: String(owner.user_id) },
      body: { roleId: 3 },
      user: { id: owner.user_id, email: owner.email, roleId: owner.role_id }
    });
    const remove = await invoke(adminController.deleteUser, {
      params: { userId: String(owner.user_id) }, user: regularAdmin
    });

    assert.strictEqual(demote.error.code, 'SUPER_ADMIN_PROTECTED');
    assert.strictEqual(remove.error.code, 'SUPER_ADMIN_PROTECTED');
  });

  it('allows the Super Admin to reset their own AI quota', async () => {
    db.query = async () => ({ rows: [owner] });
    adminService.resetUserToken = async (userId) => ({ user_id: Number(userId), used_tokens: 0 });

    const { res, error } = await invoke(adminController.resetUserToken, {
      params: { userId: String(owner.user_id) },
      user: { id: owner.user_id, email: owner.email, roleId: owner.role_id }
    });

    assert.strictEqual(error, undefined);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.success, true);
    assert.strictEqual(res.payload.data.used_tokens, 0);
  });

  it('keeps the Super Admin quota protected from a regular Admin', async () => {
    db.query = async () => ({ rows: [owner] });
    adminService.resetUserToken = async () => { throw new Error('service must not be called'); };

    const { error } = await invoke(adminController.resetUserToken, {
      params: { userId: String(owner.user_id) },
      user: regularAdmin
    });

    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.code, 'SUPER_ADMIN_PROTECTED');
  });
});
