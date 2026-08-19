/**
 * Test Suite: Auth Middleware & Error Code Classification (TASK-AUTH-SESSION-HOTFIX-01)
 *
 * Kiểm tra phân loại lỗi máy đọc được:
 * 1. Không có Bearer token -> 401 AUTH_REQUIRED
 * 2. Token rỗng -> 401 AUTH_REQUIRED
 * 3. Token hết hạn -> 401 TOKEN_EXPIRED
 * 4. Token sai định dạng / chữ ký không khớp -> 401 TOKEN_INVALID
 * 5. User không tồn tại trong CSDL -> 401 USER_DELETED
 * 6. Thiếu JWT_SECRET -> 500 AUTH_CONFIG_ERROR
 * 7. Lỗi Database query -> 500 INTERNAL_ERROR (không bị nhầm thành 401, không rò rỉ SQL)
 * 8. Token hợp lệ -> 200 OK
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const db = require('../src/config/database');
const { authenticate, authenticateVideoToken } = require('../src/middleware/auth.middleware');

describe('=== TASK-AUTH-SESSION-HOTFIX-01: Auth Middleware Test Suite ===', () => {
  let server;
  let baseUrl;
  let originalQuery;
  let originalJwtSecret;
  let simulateDbError = false;

  const mockUsers = [
    { user_id: 1, email: 'student@example.com', username: 'student', full_name: 'Student One', role_id: 3 }
  ];

  before(async () => {
    originalQuery = db.query;
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-123456';

    db.query = async (sqlText, params = []) => {
      if (simulateDbError) {
        const dbErr = new Error('Database connection pool exhausted: server deadlocked SELECT * FROM secret_table');
        dbErr.code = '57P01';
        throw dbErr;
      }
      const cleanSql = sqlText.trim();
      if (cleanSql.includes('FROM users WHERE user_id = $1 OR email = $2')) {
        const [userId, email] = params;
        const user = mockUsers.find((u) => u.user_id === Number(userId) || u.email === email);
        return { rows: user ? [user] : [] };
      }
      return { rows: [] };
    };

    const app = express();
    app.use(express.json());
    app.get('/api/protected', authenticate, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });
    app.get('/api/video/:lessonId', authenticateVideoToken, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });

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

  it('1. should return 401 AUTH_REQUIRED when no Authorization header is present', async () => {
    const res = await fetch(`${baseUrl}/api/protected`);
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'AUTH_REQUIRED');
  });

  it('2. should return 401 AUTH_REQUIRED when Authorization header has no token', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer ' }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'AUTH_REQUIRED');
  });

  it('3. should return 401 TOKEN_EXPIRED when JWT token has expired', async () => {
    const expiredToken = jwt.sign(
      { id: 1, email: 'student@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: -10 } // Expired 10s ago
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_EXPIRED');
    assert.strictEqual(data.error, 'TokenExpiredError');
  });

  it('4. should return 401 TOKEN_INVALID when JWT token signature is invalid', async () => {
    const forgedToken = jwt.sign(
      { id: 1, email: 'student@example.com' },
      'wrong-secret-signature'
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
  });

  it('5. should return 401 USER_DELETED when user does not exist in database', async () => {
    const nonExistentToken = jwt.sign(
      { id: 9999, email: 'deleted@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${nonExistentToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'USER_DELETED');
  });

  it('6. should return 500 AUTH_CONFIG_ERROR when JWT_SECRET is missing on server', async () => {
    const savedSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    const validToken = jwt.sign(
      { id: 1, email: 'student@example.com' },
      savedSecret,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();

    process.env.JWT_SECRET = savedSecret;

    assert.strictEqual(res.status, 500);
    assert.strictEqual(data.code, 'AUTH_CONFIG_ERROR');
  });

  it('7. should return 500 INTERNAL_ERROR and NOT leak raw SQL details when database fails', async () => {
    simulateDbError = true;
    const validToken = jwt.sign(
      { id: 1, email: 'student@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();
    simulateDbError = false;

    assert.strictEqual(res.status, 500);
    assert.strictEqual(data.code, '57P01');
    assert.strictEqual(data.message, 'Lỗi xử lý xác thực trên máy chủ');
    assert.strictEqual(JSON.stringify(data).includes('SELECT * FROM secret_table'), false);
  });

  it('8. should return 200 OK and attach user data when token is valid', async () => {
    const validToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, 1);
    assert.strictEqual(data.user.email, 'student@example.com');
  });

  it('9. should return 401 TOKEN_INVALID when token ID mismatches database user ID', async () => {
    const invalidIdToken = jwt.sign(
      { id: 99, email: 'student@example.com', roleId: 3 }, // id 99 will fetch student@example.com (user_id: 1) from DB, causing mismatch
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${invalidIdToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
  });

  it('10. should return 401 TOKEN_INVALID when token email mismatches database user email', async () => {
    const invalidEmailToken = jwt.sign(
      { id: 1, email: 'mismatch@example.com', roleId: 3 }, // id 1 will fetch student@example.com, causing email mismatch
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${invalidEmailToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
  });

  it('11. should return 403 TOKEN_INVALID in authenticateVideoToken when type is not video_stream_ticket', async () => {
    const regularToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 }, // No type 'video_stream_ticket'
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/video/12?ticket=${regularToken}`);
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
    assert.match(data.message, /không đúng loại vé xem video/);
  });

  it('12. should return 403 TOKEN_INVALID in authenticateVideoToken when lessonId mismatches requested URL', async () => {
    const mismatchedLessonTicket = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3, type: 'video_stream_ticket', lessonId: 99 },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    const res = await fetch(`${baseUrl}/api/video/12?ticket=${mismatchedLessonTicket}`);
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
    assert.match(data.message, /không khớp với bài học yêu cầu/);
  });

  it('13. should return 200 OK in authenticateVideoToken when ticket is fully valid and matches lessonId', async () => {
    const validTicket = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3, type: 'video_stream_ticket', lessonId: 12 },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    const res = await fetch(`${baseUrl}/api/video/12?ticket=${validTicket}`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
  });
});
