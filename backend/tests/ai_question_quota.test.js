const assert = require('node:assert/strict');
const test = require('node:test');

const db = require('../src/config/database');
const {
  getQuestionLimitForRole,
  getQuestionQuotaSnapshot,
  releaseQuestion,
  reserveQuestion
} = require('../src/modules/chatbot/services/aiQuestionQuota.service');
const { checkQuestionLimit } = require('../src/middleware/tokenLimit.middleware');
const { normalizeGeminiError } = require('../src/utils/ai-clients');

const originalQuery = db.query;

test.afterEach(() => {
  db.query = originalQuery;
});

test('role limits are Student=10, Instructor=20 and Admin/Super Admin=unlimited', () => {
  assert.equal(getQuestionLimitForRole(3), 10);
  assert.equal(getQuestionLimitForRole(2), 20);
  assert.equal(getQuestionLimitForRole(1), null);
});

test('admin dashboard quota snapshots expose 10/20/unlimited and rolling reset data', () => {
  const now = new Date('2026-08-28T12:00:00.000Z');
  const student = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 4,
    windowStartedAt: '2026-08-28T00:00:00.000Z',
    now
  });
  const instructor = getQuestionQuotaSnapshot({
    roleId: 2,
    usedQuestions: 3,
    windowStartedAt: '2026-08-28T00:00:00.000Z',
    now
  });
  const admin = getQuestionQuotaSnapshot({ roleId: 1, now });

  assert.deepEqual(
    { limit: student.limit, used: student.used, remaining: student.remaining },
    { limit: 10, used: 4, remaining: 6 }
  );
  assert.equal(student.resetAt, '2026-08-29T00:00:00.000Z');
  assert.deepEqual(
    { limit: instructor.limit, used: instructor.used, remaining: instructor.remaining },
    { limit: 20, used: 3, remaining: 17 }
  );
  assert.equal(admin.unlimited, true);
  assert.equal(admin.limit, null);
});

test('an expired rolling window is shown as unused with a full role quota', () => {
  const snapshot = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 10,
    windowStartedAt: '2026-08-27T11:59:59.000Z',
    now: new Date('2026-08-28T12:00:00.000Z')
  });

  assert.equal(snapshot.used, 0);
  assert.equal(snapshot.remaining, 10);
  assert.equal(snapshot.resetAt, null);
});

test('Admin bypasses the database-backed question quota', async () => {
  let queryCount = 0;
  db.query = async () => {
    queryCount += 1;
    return { rows: [] };
  };

  const quota = await reserveQuestion({ userId: 1, roleId: 1 });
  assert.equal(quota.granted, true);
  assert.equal(quota.unlimited, true);
  assert.equal(queryCount, 0);
});

test('Student request is reserved atomically and exposes remaining questions', async () => {
  db.query = async (sql, params) => {
    assert.match(sql, /ON CONFLICT \(user_id\) DO UPDATE/);
    assert.deepEqual(params, [7, 10]);
    return {
      rows: [{
        used_questions: 4,
        window_started_at: '2026-08-28T00:00:00.000Z',
        granted: true
      }]
    };
  };

  const quota = await reserveQuestion({ userId: 7, roleId: 3 });
  assert.equal(quota.granted, true);
  assert.equal(quota.limit, 10);
  assert.equal(quota.used, 4);
  assert.equal(quota.remaining, 6);
  assert.equal(quota.resetAt, '2026-08-29T00:00:00.000Z');
});

test('middleware returns a structured 429 when the rolling 24-hour quota is exhausted', async () => {
  db.query = async () => ({
    rows: [{
      used_questions: 10,
      window_started_at: new Date().toISOString(),
      granted: false
    }]
  });

  const req = { user: { id: 9, roleId: 3 } };
  const response = { statusCode: 200, payload: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(payload) {
      response.payload = payload;
      return this;
    }
  };
  let nextCalled = false;

  await checkQuestionLimit(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 429);
  assert.equal(response.payload.code, 'AI_QUESTION_LIMIT_REACHED');
  assert.equal(response.payload.quota.limit, 10);
  assert.equal(response.payload.quota.remaining, 0);
});

test('failed AI requests can release a reserved question without crossing windows', async () => {
  db.query = async (sql, params) => {
    assert.match(sql, /GREATEST\(used_questions - 1, 0\)/);
    assert.deepEqual(params, [12, '2026-08-28T00:00:00.000Z']);
    return { rows: [] };
  };

  const reservation = {
    granted: true,
    unlimited: false,
    released: false,
    userId: 12,
    windowStartedAt: '2026-08-28T00:00:00.000Z'
  };

  await releaseQuestion(reservation);
  assert.equal(reservation.released, true);
});

test('Gemini provider quota errors are normalized for every user role', () => {
  const providerError = new Error('429 RESOURCE_EXHAUSTED: Quota exceeded');
  providerError.status = 429;

  const normalized = normalizeGeminiError(providerError);
  assert.equal(normalized.status, 503);
  assert.equal(normalized.code, 'GEMINI_QUOTA_EXHAUSTED');
  assert.match(normalized.message, /Gemini 3\.7 Flash/);
});
