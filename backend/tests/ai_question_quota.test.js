const assert = require('node:assert/strict');
const test = require('node:test');

const db = require('../src/config/database');
const {
  getQuestionLimitForRole,
  getQuestionQuotaSnapshot,
  getVietnamDateString,
  getNextVietnamMidnightMs,
  releaseQuestion,
  reserveQuestion
} = require('../src/modules/chatbot/services/aiQuestionQuota.service');
const { checkQuestionLimit } = require('../src/middleware/tokenLimit.middleware');
const { normalizeGeminiError } = require('../src/utils/ai-clients');

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

const originalQuery = db.query;

test.afterEach(() => {
  db.query = originalQuery;
});

test('role limits are Student=10, Instructor=20 and Admin/Super Admin=unlimited', () => {
  assert.equal(getQuestionLimitForRole(3), 10);
  assert.equal(getQuestionLimitForRole(2), 20);
  assert.equal(getQuestionLimitForRole(1), null);
});

test('admin dashboard quota snapshots expose 10/20/unlimited and daily-midnight reset data', () => {
  // 2026-08-28T12:00:00Z = 2026-08-28T19:00:00 VN time
  // windowStartedAt = 2026-08-28T00:00:00Z = 2026-08-28T07:00:00 VN time
  // Both are same VN calendar day (28/08), so window is active.
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
  // Next VN midnight after 2026-08-28T19:00 VN = 2026-08-29T00:00 VN = 2026-08-28T17:00Z
  assert.equal(student.resetAt, '2026-08-28T17:00:00.000Z');
  assert.deepEqual(
    { limit: instructor.limit, used: instructor.used, remaining: instructor.remaining },
    { limit: 20, used: 3, remaining: 17 }
  );
  assert.equal(admin.unlimited, true);
  assert.equal(admin.limit, null);
});

test('a window from a previous VN calendar day is shown as unused with a full role quota', () => {
  // windowStartedAt = 2026-08-27T11:59:59Z = 2026-08-27T18:59:59 VN (Aug 27)
  // now = 2026-08-28T12:00:00Z = 2026-08-28T19:00:00 VN (Aug 28)
  // Different VN calendar days → window expired
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
  // resetAt should be next VN midnight from now, which is dynamic.
  // Just verify it's a valid ISO string in the future-ish.
  assert.ok(quota.resetAt);
  assert.ok(new Date(quota.resetAt).getTime() > 0);
});

test('reserveQuestion SQL uses AT TIME ZONE calendar-day comparison, not 24h interval', async () => {
  db.query = async (sql) => {
    // Verify the SQL contains AT TIME ZONE for VN-time calendar day comparison
    assert.match(sql, /AT TIME ZONE 'Asia\/Ho_Chi_Minh'/);
    assert.match(sql, /date_trunc\('day'/);
    // Verify the old rolling 24h pattern is gone
    assert.doesNotMatch(sql, /INTERVAL '24 hours'/);
    return {
      rows: [{
        used_questions: 1,
        window_started_at: new Date().toISOString(),
        granted: true
      }]
    };
  };

  await reserveQuestion({ userId: 42, roleId: 3 });
});

test('middleware returns a structured 429 when the daily quota is exhausted', async () => {
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
  const providerError = new Error('429 RESOURCE_EXHAUSTED: Quota exceeded. Please retry in 9.25s.');
  providerError.status = 429;

  const normalized = normalizeGeminiError(providerError);
  assert.equal(normalized.status, 503);
  assert.equal(normalized.code, 'GEMINI_QUOTA_EXHAUSTED');
  assert.match(normalized.message, /Dịch vụ Gemini/);
  assert.doesNotMatch(normalized.message, /3\.7 Flash/);
  assert.equal(normalized.retryAfterMs, 9250);
});

// ─── NEW: Vietnam midnight boundary tests ──────────────────────────────────

test('getVietnamDateString correctly computes VN calendar date from UTC timestamps', () => {
  // 2026-09-03T16:59:59.999Z = 2026-09-03T23:59:59.999 VN → still Sep 3
  assert.equal(getVietnamDateString(new Date('2026-09-03T16:59:59.999Z').getTime()), '2026-09-03');
  // 2026-09-03T17:00:00.000Z = 2026-09-04T00:00:00.000 VN → Sep 4
  assert.equal(getVietnamDateString(new Date('2026-09-03T17:00:00.000Z').getTime()), '2026-09-04');
});

test('getNextVietnamMidnightMs computes next VN midnight correctly', () => {
  // 2026-09-03T23:50 VN = 2026-09-03T16:50 UTC
  // Next VN midnight = 2026-09-04T00:00 VN = 2026-09-03T17:00 UTC
  const nowMs = new Date('2026-09-03T16:50:00.000Z').getTime();
  const nextMidnight = getNextVietnamMidnightMs(nowMs);
  assert.equal(new Date(nextMidnight).toISOString(), '2026-09-03T17:00:00.000Z');

  // 2026-09-04T00:01 VN = 2026-09-03T17:01 UTC
  // Next VN midnight = 2026-09-05T00:00 VN = 2026-09-04T17:00 UTC
  const nowMs2 = new Date('2026-09-03T17:01:00.000Z').getTime();
  const nextMidnight2 = getNextVietnamMidnightMs(nowMs2);
  assert.equal(new Date(nextMidnight2).toISOString(), '2026-09-04T17:00:00.000Z');

  // Exactly at VN midnight: 2026-09-04T00:00:00.000 VN = 2026-09-03T17:00:00.000Z
  // Next VN midnight should be 24h later (start of new day, reset is 24h away)
  const atMidnight = new Date('2026-09-03T17:00:00.000Z').getTime();
  const nextFromMidnight = getNextVietnamMidnightMs(atMidnight);
  assert.equal(new Date(nextFromMidnight).toISOString(), '2026-09-04T17:00:00.000Z');
});

test('(a) 23:59 VN and 00:01 VN on next day are different quota windows', () => {
  // 2026-09-03T23:59 VN = 2026-09-03T16:59 UTC
  // windowStartedAt at 2026-09-03T08:00 VN = 2026-09-03T01:00 UTC (same VN day as 23:59)
  const windowStartedAt = '2026-09-03T01:00:00.000Z'; // 08:00 VN on Sep 3

  // At 23:59 VN same day → window should be ACTIVE
  const snapshot2359 = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 9,
    windowStartedAt,
    now: new Date('2026-09-03T16:59:00.000Z') // 23:59 VN
  });
  assert.equal(snapshot2359.used, 9);
  assert.equal(snapshot2359.remaining, 1);
  assert.ok(snapshot2359.resetAt); // should have a resetAt

  // At 00:01 VN next day → window should be EXPIRED (new VN calendar day)
  const snapshot0001 = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 9,
    windowStartedAt,
    now: new Date('2026-09-03T17:01:00.000Z') // 00:01 VN on Sep 4
  });
  assert.equal(snapshot0001.used, 0);
  assert.equal(snapshot0001.remaining, 10);
  assert.equal(snapshot0001.resetAt, null); // no active window
});

test('(b) 08:00 VN and 23:00 VN on the same day are in the SAME quota window', () => {
  // windowStartedAt at 2026-09-03T08:00 VN = 2026-09-03T01:00 UTC
  const windowStartedAt = '2026-09-03T01:00:00.000Z';

  const snapshot0800 = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 3,
    windowStartedAt,
    now: new Date('2026-09-03T01:00:00.000Z') // 08:00 VN
  });
  assert.equal(snapshot0800.used, 3);
  assert.equal(snapshot0800.remaining, 7);

  const snapshot2300 = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 7,
    windowStartedAt,
    now: new Date('2026-09-03T16:00:00.000Z') // 23:00 VN
  });
  assert.equal(snapshot2300.used, 7);
  assert.equal(snapshot2300.remaining, 3);

  // Both should have resetAt pointing to next VN midnight (Sep 4 00:00 VN = Sep 3 17:00 UTC)
  assert.equal(snapshot0800.resetAt, '2026-09-03T17:00:00.000Z');
  assert.equal(snapshot2300.resetAt, '2026-09-03T17:00:00.000Z');
});

test('(c) resetAt at 23:50 VN computes to 10 minutes later (next VN midnight), not 24h later', () => {
  // now = 2026-09-03T23:50 VN = 2026-09-03T16:50 UTC
  // windowStartedAt = same VN day = 2026-09-03T08:00 VN = 2026-09-03T01:00 UTC
  const snapshot = getQuestionQuotaSnapshot({
    roleId: 3,
    usedQuestions: 10,
    windowStartedAt: '2026-09-03T01:00:00.000Z',
    now: new Date('2026-09-03T16:50:00.000Z')
  });

  // resetAt must be 2026-09-04T00:00 VN = 2026-09-03T17:00 UTC (10 minutes after now)
  assert.equal(snapshot.resetAt, '2026-09-03T17:00:00.000Z');

  // Verify it's exactly 10 minutes after now
  const nowMs = new Date('2026-09-03T16:50:00.000Z').getTime();
  const resetMs = new Date(snapshot.resetAt).getTime();
  assert.equal(resetMs - nowMs, 10 * 60 * 1000); // 10 minutes = 600,000ms
});
