/**
 * Automated Schema Parity & Versioned Migration Test Suite
 *
 * Verifies:
 * 1. Live database schema parity with schema.sql for critical tables (quizzes, quiz_attempts)
 * 2. Strict nullability alignment (quiz_attempts.quiz_id NOT NULL, user_id nullable for guest attempts)
 * 3. Migration tracking table integrity (schema_migrations)
 * 4. Idempotency of runPendingMigrations()
 *
 * Team:
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 */

const { pool } = require('../src/config/database');
const { runPendingMigrations, getAppliedMigrations } = require('../src/utils/migrationRunner');

describe('Database Schema Parity & Migration Integrity', () => {
  let client;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    if (client) client.release();
    await pool.end();
  });

  test('schema_migrations table tracks all versioned migrations', async () => {
    const applied = await getAppliedMigrations(client);
    expect(applied.size).toBeGreaterThanOrEqual(14);
    expect(applied.has('001_initial_schema')).toBe(true);
    expect(applied.has('002_quizzes_and_attempts_parity')).toBe(true);
  });

  test('migrationRunner.runPendingMigrations is idempotent and produces no drifts', async () => {
    const result = await runPendingMigrations({ dbClient: client, silent: true });
    expect(result.appliedCount).toBe(0);
    expect(result.skippedCount).toBeGreaterThanOrEqual(14);
  });

  test('quizzes table matches required columns in schema.sql and live DB', async () => {
    const res = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'quizzes'
    `);
    const cols = new Map(res.rows.map(r => [r.column_name, r]));

    const expectedCols = [
      'quiz_id',
      'course_id',
      'lesson_id',
      'title',
      'description',
      'difficulty',
      'time_limit',
      'is_private',
      'pin_code',
      'created_at',
      'updated_at'
    ];

    expectedCols.forEach(col => {
      expect(cols.has(col)).toBe(true);
    });

    expect(cols.get('quiz_id').is_nullable).toBe('NO');
    expect(cols.get('title').is_nullable).toBe('NO');
  });

  test('quiz_attempts table matches required columns, NOT NULL quiz_id, and nullable user_id', async () => {
    const res = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'quiz_attempts'
    `);
    const cols = new Map(res.rows.map(r => [r.column_name, r]));

    const expectedCols = [
      'attempt_id',
      'user_id',
      'quiz_id',
      'score',
      'completed_at',
      'nickname'
    ];

    expectedCols.forEach(col => {
      expect(cols.has(col)).toBe(true);
    });

    // Parity rules
    expect(cols.get('attempt_id').is_nullable).toBe('NO');
    expect(cols.get('quiz_id').is_nullable).toBe('NO');
    expect(cols.get('score').is_nullable).toBe('NO');
    expect(cols.get('user_id').is_nullable).toBe('YES'); // Allows guest attempts with nickname
    expect(cols.get('nickname').is_nullable).toBe('YES');
  });

  test('core operational tables exist in live PostgreSQL public schema', async () => {
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tableSet = new Set(res.rows.map(r => r.table_name));

    const essentialTables = [
      'users',
      'roles',
      'courses',
      'sections',
      'lessons',
      'user_progress',
      'quizzes',
      'questions',
      'quiz_attempts',
      'ai_chat',
      'lesson_comments',
      'course_discussions',
      'media_assets',
      'schema_migrations'
    ];

    essentialTables.forEach(tableName => {
      expect(tableSet.has(tableName)).toBe(true);
    });
  });
});
