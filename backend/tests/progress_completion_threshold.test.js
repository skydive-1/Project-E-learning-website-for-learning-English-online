const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const db = require('../src/config/database');
const progressRoutes = require('../src/modules/progress/progress.routes');
const errorHandler = require('../src/middleware/error.middleware');

describe('Backend lesson-completion score threshold', () => {
  let baseUrl;
  let server;
  let originalQuery;
  let originalJwtSecret;
  let bestScore = 49;
  let progressWriteCount = 0;

  before(async () => {
    originalQuery = db.query;
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'progress-threshold-test-secret';

    db.query = async (sql, params = []) => {
      const statement = String(sql);

      if (statement.includes('FROM users WHERE user_id = $1 OR email = $2')) {
        return {
          rows: [{
            user_id: 42,
            email: 'learner@example.com',
            username: 'learner',
            full_name: 'Threshold Learner',
            role_id: 3
          }]
        };
      }

      if (statement.includes('COUNT(q.quiz_id)::int AS quiz_count')) {
        assert.deepEqual(params, [42, 7]);
        return { rows: [{ quiz_count: 1, best_score: bestScore }] };
      }

      if (statement.includes('INSERT INTO user_progress')) {
        progressWriteCount += 1;
        return {
          rows: [{
            progress_id: 10,
            user_id: params[0],
            lesson_id: params[1],
            is_completed: params[2]
          }]
        };
      }

      if (statement.includes('UPDATE learning_ss')) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [] };
    };

    const app = express();
    app.use(express.json());
    app.use('/api/progress', progressRoutes);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    db.query = originalQuery;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  const rawCompletionRequest = () => {
    const token = jwt.sign(
      { id: 42, email: 'learner@example.com', roleId: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return fetch(`${baseUrl}/api/progress`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 42,
        lessonId: 7,
        isCompleted: true,
        score: 100
      })
    });
  };

  it('rejects a raw completion API request when the server-side stored score is 49%', async () => {
    bestScore = 49;
    progressWriteCount = 0;

    const response = await rawCompletionRequest();
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.success, false);
    assert.equal(body.code, 'LESSON_COMPLETION_SCORE_TOO_LOW');
    assert.deepEqual(body.details, { requiredScore: 50, bestScore: 49 });
    assert.equal(progressWriteCount, 0);
  });

  it('ignores a spoofed client score and accepts completion only when the stored score reaches 50%', async () => {
    bestScore = 50;
    progressWriteCount = 0;

    const response = await rawCompletionRequest();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.progress.is_completed, true);
    assert.equal(progressWriteCount, 1);
  });
});
