/**
 * Test Suite: Chatbot History Auth & Authorization Vulnerability Patch
 * 
 * Verification of security controls on /api/chatbot/history endpoints:
 * 1. Unauthenticated requests returned 401 AUTH_REQUIRED
 * 2. User A accessing User B's history returned 403 FORBIDDEN
 * 3. User A accessing User A's history returned 200 / 201 OK
 * 4. Admin user accessing User B's history returned 200 / 201 OK
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const db = require('../src/config/database');
const chatbotRoutes = require('../src/modules/chatbot/chatbot.routes');
const errorHandler = require('../src/middleware/error.middleware');

describe('=== Chatbot History Auth & Authorization Security Test Suite ===', () => {
  let server;
  let baseUrl;
  let originalQuery;
  let originalJwtSecret;
  const deleteQueries = [];

  const mockUsers = [
    { user_id: 1, email: 'user1@example.com', username: 'user1', full_name: 'User One', role_id: 3 },
    { user_id: 2, email: 'user2@example.com', username: 'user2', full_name: 'User Two', role_id: 3 },
    { user_id: 99, email: 'admin@example.com', username: 'admin', full_name: 'System Admin', role_id: 1 }
  ];

  before(async () => {
    originalQuery = db.query;
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-chatbot-history-auth';

    db.query = async (sqlText, params = []) => {
      const cleanSql = sqlText.trim();
      if (cleanSql.includes('FROM users WHERE user_id = $1 OR email = $2')) {
        const [userId, email] = params;
        const user = mockUsers.find((u) => u.user_id === Number(userId) || u.email === email);
        return { rows: user ? [user] : [] };
      }
      if (cleanSql.includes('INSERT INTO ai_chat')) {
        return { rows: [{ ai_chat: 101, student_id: params[0], lesson_id: params[1] }] };
      }
      if (cleanSql.includes('SELECT ai_chat, sender_type')) {
        return {
          rows: [
            { ai_chat: 101, sender_type: 'user', title: 'Hello AI', created_date: new Date().toISOString() },
            { ai_chat: 102, sender_type: 'bot', title: 'Hello User!', created_date: new Date().toISOString() }
          ]
        };
      }
      if (cleanSql === 'DELETE FROM ai_chat WHERE student_id = $1 AND lesson_id = $2') {
        deleteQueries.push({ sql: cleanSql, params });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    };

    const app = express();
    app.use(express.json());
    app.use('/api/chatbot', chatbotRoutes);
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

  it('1. POST /api/chatbot/history should return 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/api/chatbot/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 1, lesson_id: 10, question: 'Hi', answer: 'Hello' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'AUTH_REQUIRED');
  });

  it('2. GET /api/chatbot/history/:userId/:lessonId should return 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/api/chatbot/history/1/10`);
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'AUTH_REQUIRED');
  });

  it('3. POST /api/chatbot/history should return 403 when User 1 attempts to save history for User 2', async () => {
    const user1Token = jwt.sign(
      { id: 1, email: 'user1@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/chatbot/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({ user_id: 2, lesson_id: 10, question: 'Hack test', answer: 'Hacked' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'FORBIDDEN');
    assert.match(data.message, /không có quyền/i);
  });

  it('4. GET /api/chatbot/history/2/10 should return 403 when User 1 attempts to read User 2 history', async () => {
    const user1Token = jwt.sign(
      { id: 1, email: 'user1@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/chatbot/history/2/10`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'FORBIDDEN');
    assert.match(data.message, /không có quyền/i);
  });

  it('5. POST /api/chatbot/history should return 201 when User 1 saves their own history', async () => {
    const user1Token = jwt.sign(
      { id: 1, email: 'user1@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/chatbot/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({ user_id: 1, lesson_id: 10, question: 'My Question', answer: 'My Answer' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
  });

  it('6. GET /api/chatbot/history/1/10 should return 200 when User 1 reads their own history', async () => {
    const user1Token = jwt.sign(
      { id: 1, email: 'user1@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/chatbot/history/1/10`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(data), true);
  });

  it('7. GET /api/chatbot/history/2/10 should return 200 when Admin (role 1) accesses User 2 history', async () => {
    const adminToken = jwt.sign(
      { id: 99, email: 'admin@example.com', roleId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/chatbot/history/2/10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(data), true);
  });

  it('8. DELETE /api/chatbot/history/:lessonId should accept an authenticated body-less request', async () => {
    const user1Token = jwt.sign(
      { id: 1, email: 'user1@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/chatbot/history/10`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(deleteQueries.at(-1)?.params, [1, 10]);
  });
});
