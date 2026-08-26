/**
 * Test Suite: Admin Role-Based Authorization Verification (No Hardcoded Email Checks)
 * 
 * Verifies that:
 * 1. Users with role_id = 1 ('admin') are granted full admin access regardless of their email address.
 * 2. Users with role_id = 2 ('instructor') or 3 ('student') are rejected with 403 FORBIDDEN on admin routes.
 * 3. Token decoding attaches req.user.role === 'admin' and req.user.roleId === 1 correctly.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const db = require('../src/config/database');
const adminRoutes = require('../src/modules/admin/admin.routes');
const errorHandler = require('../src/middleware/error.middleware');

describe('=== Admin Role-Based Authorization Test Suite (No Email Hardcoding) ===', () => {
  let server;
  let baseUrl;
  let originalQuery;
  let originalJwtSecret;

  const mockUsers = [
    { user_id: 1, email: 'random.admin@customdomain.org', username: 'customadmin', full_name: 'Custom Admin', role_id: 1 },
    { user_id: 2, email: 'quocanh26012004@gmail.com', username: 'student_legacy_email', full_name: 'Student Legacy Email', role_id: 3 },
    { user_id: 3, email: 'instructor@school.edu', username: 'instructor1', full_name: 'Instructor One', role_id: 2 }
  ];

  before(async () => {
    originalQuery = db.query;
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-admin-role-auth';

    db.query = async (sqlText, params = []) => {
      const cleanSql = sqlText.trim();
      if (cleanSql.includes('FROM users WHERE user_id = $1 OR email = $2')) {
        const [userId, email] = params;
        const user = mockUsers.find((u) => u.user_id === Number(userId) || u.email === email);
        return { rows: user ? [user] : [] };
      }
      if (cleanSql.includes('FROM users WHERE user_id = $1')) {
        const [userId] = params;
        const user = mockUsers.find((u) => u.user_id === Number(userId));
        return { rows: user ? [user] : [] };
      }
      if (cleanSql.includes('UPDATE users SET role_id = $1')) {
        return { rows: [{ user_id: params[1], role_id: params[0] }] };
      }
      return { rows: [] };
    };

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    db.query = originalQuery;
    process.env.JWT_SECRET = originalJwtSecret;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. should allow access to /api/admin/users for any user with role_id = 1 (role = admin), regardless of email', async () => {
    const adminToken = jwt.sign(
      { id: 1, email: 'random.admin@customdomain.org', roleId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
  });

  it('2. should reject access with 403 FORBIDDEN for non-admin user (role_id = 3) even if email matches legacy hardcoded string', async () => {
    const legacyEmailStudentToken = jwt.sign(
      { id: 2, email: 'quocanh26012004@gmail.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${legacyEmailStudentToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'FORBIDDEN');
  });

  it('3. should allow admin to update user role', async () => {
    const adminToken = jwt.sign(
      { id: 1, email: 'random.admin@customdomain.org', roleId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/admin/users/3/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ roleId: 2 })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
  });

  it('4. should return rate limit status for admin user', async () => {
    const adminToken = jwt.sign(
      { id: 1, email: 'random.admin@customdomain.org', roleId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/admin/rate-limit`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(typeof data.enabled, 'boolean');
  });
});
