const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const gamificationService = require('../src/modules/gamification/services/gamification.service');
const gamificationController = require('../src/modules/gamification/controllers/gamification.controller');
const db = require('../src/config/database');

const stubSummaryQueries = ({ users, metricsByUser, daysByUser }) => {
  const originalQuery = db.query;
  db.query = async (sql, params) => {
    if (sql.includes('FROM users ORDER BY user_id')) {
      return { rows: users.map(user_id => ({ user_id })) };
    }
    if (sql.includes('WITH completed_progress')) {
      const userId = params[0];
      return { rows: [metricsByUser[userId]] };
    }
    if (sql.includes('SELECT DISTINCT')) {
      const userId = params[0];
      return { rows: (daysByUser[userId] || []).map(day => ({ day })) };
    }
    throw new Error(`Unexpected query in test: ${sql}`);
  };
  return () => {
    db.query = originalQuery;
  };
};

describe('Gamification badges locked/unlocked workflow', () => {
  let restore = null;
  afterEach(() => {
    if (restore) {
      restore();
      restore = null;
    }
  });

  it('trả về đủ 8 huy hiệu kèm điều kiện và tiến độ đo thật', async () => {
    restore = stubSummaryQueries({
      users: [42],
      metricsByUser: {
        42: {
          completed_lessons: 2,
          first_lesson_day: '2026-09-10',
          perfect_quizzes: 2,
          quiz_master_day: null,
          ai_questions: 3,
          ai_interactive_day: null,
          grammar_total: 4,
          grammar_completed: 1,
          grammar_completed_day: null,
          max_daily_completions: 2,
          speed_learner_day: null
        }
      },
      daysByUser: { 42: ['2026-09-10'] }
    });

    const badges = await gamificationService.getUserBadges(42);

    assert.strictEqual(badges.length, 8);
    // Hiển thị tất cả, chỉ unlocked khi đủ điều kiện
    assert.strictEqual(badges.find(b => b.id === 'first_lesson').unlocked, true);
    assert.strictEqual(badges.find(b => b.id === 'quiz_master').unlocked, false);
    assert.ok(badges.every(b => typeof b.requirement === 'string' && b.requirement.length > 0));
    assert.deepStrictEqual(
      badges.find(b => b.id === 'quiz_master').progress,
      { current: 2, target: 5, unit: 'quiz' }
    );
  });

  it('rà soát toàn bộ user và đếm unlocked theo dữ liệu học tập thật', async () => {
    restore = stubSummaryQueries({
      users: [1, 2],
      metricsByUser: {
        1: {
          completed_lessons: 1,
          first_lesson_day: '2026-09-10',
          perfect_quizzes: 0,
          quiz_master_day: null,
          ai_questions: 0,
          ai_interactive_day: null,
          grammar_total: 0,
          grammar_completed: 0,
          grammar_completed_day: null,
          max_daily_completions: 1,
          speed_learner_day: null
        },
        2: {
          completed_lessons: 0,
          first_lesson_day: null,
          perfect_quizzes: 0,
          quiz_master_day: null,
          ai_questions: 0,
          ai_interactive_day: null,
          grammar_total: 0,
          grammar_completed: 0,
          grammar_completed_day: null,
          max_daily_completions: 0,
          speed_learner_day: null
        }
      },
      daysByUser: { 1: ['2026-09-10'], 2: [] }
    });

    const result = await gamificationService.evaluateAllUsers({ limit: 10, offset: 0 });

    assert.strictEqual(result.scanned, 2);
    assert.strictEqual(result.unlockedCounts.first_lesson, 1);
    assert.strictEqual(result.users.find(u => u.user_id === 1).unlockedCount, 1);
    assert.strictEqual(result.users.find(u => u.user_id === 2).unlockedCount, 0);
  });

  it('controller resync trả 200 với snapshot đồng bộ', async () => {
    restore = stubSummaryQueries({
      users: [7],
      metricsByUser: {
        7: {
          completed_lessons: 5,
          first_lesson_day: '2026-09-01',
          perfect_quizzes: 5,
          quiz_master_day: '2026-09-05',
          ai_questions: 10,
          ai_interactive_day: '2026-09-06',
          grammar_total: 2,
          grammar_completed: 2,
          grammar_completed_day: '2026-09-07',
          max_daily_completions: 3,
          speed_learner_day: '2026-09-07'
        }
      },
      daysByUser: { 7: ['2026-09-07'] }
    });

    const req = { query: { limit: '10', offset: '0' } };
    const response = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };

    await gamificationController.resyncAllBadges(req, response, err => {
      throw err;
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.body.data.scanned, 1);
    assert.ok(response.body.data.users[0].unlockedCount > 0);
  });
});
