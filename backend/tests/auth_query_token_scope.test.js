/**
 * Test Suite: Auth Query Token Scope & PDF Access Isolation
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 *
 * Kiểm tra phạm vi token qua query string:
 * 1. authenticate() thông thường KHÔNG chấp nhận ?token= query parameter (trả về 401 AUTH_REQUIRED)
 * 2. authenticatePdfAccess() chấp nhận ?token= query parameter khi không có header Authorization (trả về 200 OK)
 * 3. authenticatePdfAccess() chấp nhận header Authorization Bearer bình thường (trả về 200 OK)
 * 4. authenticatePdfAccess() từ chối token query không hợp lệ / hết hạn (trả về 401)
 * 5. Route POST /api/lessons/:lessonId/generate-subtitles đã được khôi phục thành công
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const db = require('../src/config/database');
const {
  authenticate,
  authenticateInstructorRealtimeTicket
} = require('../src/middleware/auth.middleware');
const { authenticatePdfAccess } = require('../src/middleware/pdfAccess.middleware');
const lessonsRoutes = require('../src/modules/lessons/lessons.routes');
const instructorRoutes = require('../src/modules/instructor/instructor.routes');
const realtimeController = require('../src/modules/instructor/controllers/realtime.controller');

describe('=== Auth Query Token Scope & PDF Access Test Suite ===', () => {
  let server;
  let baseUrl;
  let originalQuery;
  let originalJwtSecret;

  const mockUsers = [
    { user_id: 1, email: 'student@example.com', username: 'student', full_name: 'Student One', role_id: 3 },
    { user_id: 2, email: 'instructor@example.com', username: 'teacher', full_name: 'Instructor One', role_id: 2 },
    { user_id: 3, email: 'admin@example.com', username: 'admin', full_name: 'Admin One', role_id: 1 }
  ];

  before(async () => {
    originalQuery = db.query;
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-pdf-scope-123456';

    db.query = async (sqlText, params = []) => {
      const cleanSql = String(sqlText).trim();
      if (cleanSql.includes('FROM users WHERE user_id = $1 OR email = $2')) {
        const [userId, email] = params;
        const user = mockUsers.find((u) => u.user_id === Number(userId) || u.email === email);
        return { rows: user ? [user] : [] };
      }
      if (cleanSql.includes('UPDATE users SET last_seen_at')) {
        return { rowCount: 1 };
      }
      return { rows: [] };
    };

    const app = express();
    app.use(express.json());

    // Route hệ thống chung sử dụng authenticate() (ví dụ /api/auth/profile, /api/admin/*)
    app.get('/api/auth/profile', authenticate, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });

    // Route xem/tải PDF sử dụng authenticatePdfAccess()
    app.get('/api/lessons/:lessonId/pdf', authenticatePdfAccess, (req, res) => {
      res.status(200).json({
        success: true,
        message: 'PDF access granted',
        user: req.user,
        lessonId: req.params.lessonId
      });
    });

    app.get('/api/lessons/:lessonId/pdf/download', authenticatePdfAccess, (req, res) => {
      res.status(200).json({
        success: true,
        message: 'PDF download granted',
        user: req.user,
        lessonId: req.params.lessonId
      });
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

  it('1. should return 401 AUTH_REQUIRED when sending ?token= to a general route using authenticate() without Authorization header', async () => {
    const validToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/auth/profile?token=${encodeURIComponent(validToken)}`);
    const data = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'AUTH_REQUIRED');
    assert.strictEqual(data.message, 'Không có token xác thực, quyền truy cập bị từ chối');
  });

  it('2. should return 200 OK when sending ?token= to a PDF route using authenticatePdfAccess() without Authorization header', async () => {
    const validToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/101/pdf?token=${encodeURIComponent(validToken)}`);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, 1);
    assert.strictEqual(data.user.email, 'student@example.com');
    assert.strictEqual(data.lessonId, '101');
  });

  it('3. should return 200 OK when sending Authorization: Bearer header to a PDF route without query token', async () => {
    const validToken = jwt.sign(
      { id: 2, email: 'instructor@example.com', roleId: 2 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/101/pdf`, {
      headers: {
        Authorization: `Bearer ${validToken}`
      }
    });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, 2);
    assert.strictEqual(data.user.role, 'instructor');
  });

  it('4. should return 401 TOKEN_EXPIRED when sending expired token via query string to PDF route', async () => {
    const expiredToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/101/pdf?token=${encodeURIComponent(expiredToken)}`);
    const data = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_EXPIRED');
  });

  it('5. should return 401 TOKEN_INVALID when sending corrupted token via query string to PDF route', async () => {
    const res = await fetch(`${baseUrl}/api/lessons/101/pdf?token=invalid.token.payload`);
    const data = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
  });

  it('6. issues a short-lived instructor realtime ticket without reusing the session token', () => {
    let responseBody;
    realtimeController.createTicket(
      { user: { id: mockUsers[1].user_id, email: mockUsers[1].email } },
      {
        status(code) {
          assert.strictEqual(code, 200);
          return this;
        },
        json(body) {
          responseBody = body;
          return body;
        }
      },
      error => { throw error; }
    );

    const decoded = jwt.verify(responseBody.data.ticket, process.env.JWT_SECRET);
    assert.strictEqual(decoded.id, 2);
    assert.strictEqual(decoded.type, 'instructor_realtime_ticket');
    assert.ok(decoded.exp - decoded.iat <= 60);
  });

  it('7. accepts only the dedicated realtime ticket through the scoped query parameter', async () => {
    const ticket = jwt.sign({
      id: 2,
      email: 'instructor@example.com',
      type: 'instructor_realtime_ticket'
    }, process.env.JWT_SECRET, { expiresIn: '60s' });
    const req = { query: { ticket } };
    let nextCalled = false;

    await authenticateInstructorRealtimeTicket(req, {
      status() { return this; },
      json(body) { throw new Error(`Unexpected auth rejection: ${body.code}`); }
    }, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.id, 2);
    assert.strictEqual(req.user.roleId, 2);

    const sessionToken = jwt.sign(
      { id: 2, email: 'instructor@example.com', roleId: 2 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    let rejection;
    await authenticateInstructorRealtimeTicket(
      { query: { ticket: sessionToken } },
      {
        status(code) { rejection = { code }; return this; },
        json(body) { rejection.body = body; return body; }
      },
      () => { throw new Error('Session token must not open an SSE stream'); }
    );
    assert.strictEqual(rejection.code, 403);
    assert.strictEqual(rejection.body.code, 'REALTIME_TICKET_INVALID');
  });

  it('8. should confirm protected subtitle and realtime ticket routes are registered', () => {
    // Kiểm tra router lessons.routes có tồn tại route generate-subtitles
    const routes = lessonsRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    const generateSubtitlesRoute = routes.find(
      (r) => r.path === '/:lessonId/generate-subtitles' && r.methods.includes('post')
    );

    assert.ok(generateSubtitlesRoute, 'POST /:lessonId/generate-subtitles must be registered in lessons.routes.js');

    // Kiểm tra 4 route PDF đều tồn tại
    const pdfRoute = routes.find((r) => r.path === '/:lessonId/pdf' && r.methods.includes('get'));
    const pdfDownloadRoute = routes.find((r) => r.path === '/:lessonId/pdf/download' && r.methods.includes('get'));
    const matPreviewRoute = routes.find((r) => r.path === '/:lessonId/materials/:materialId/preview' && r.methods.includes('get'));
    const matDownloadRoute = routes.find((r) => r.path === '/:lessonId/materials/:materialId/download' && r.methods.includes('get'));

    assert.ok(pdfRoute, 'GET /:lessonId/pdf must be registered');
    assert.ok(pdfDownloadRoute, 'GET /:lessonId/pdf/download must be registered');
    assert.ok(matPreviewRoute, 'GET /:lessonId/materials/:materialId/preview must be registered');
    assert.ok(matDownloadRoute, 'GET /:lessonId/materials/:materialId/download must be registered');

    const instructorRouteList = instructorRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));
    assert.ok(
      instructorRouteList.some(route => route.path === '/realtime/stream' && route.methods.includes('get')),
      'GET /realtime/stream must be registered'
    );
    assert.ok(
      instructorRouteList.some(route => route.path === '/realtime/ticket' && route.methods.includes('post')),
      'POST /realtime/ticket must be registered'
    );
  });
});
