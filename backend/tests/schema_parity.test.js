'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');
const { runPendingMigrations } = require('../src/utils/migrationRunner');

const backendRoot = path.join(__dirname, '..');
const migrationsDir = path.join(backendRoot, 'migrations');
const schemaSql = fs.readFileSync(path.join(backendRoot, 'schema.sql'), 'utf8');
const paritySql = fs.readFileSync(
  path.join(migrationsDir, '002_quizzes_and_attempts_parity.sql'),
  'utf8'
);
const academyRoadmapSql = fs.readFileSync(
  path.join(migrationsDir, '20260912_academy_course_roadmap.sql'),
  'utf8'
);

function getTableDefinition(sql, tableName) {
  const match = sql.match(new RegExp(
    `CREATE TABLE IF NOT EXISTS\\s+${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'i'
  ));
  assert.ok(match, `schema.sql: thiếu bảng ${tableName}`);
  return match[1];
}

describe('Database Schema Parity & Migration Integrity', () => {
  let tempMigrationsDir;

  before(() => {
    tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-learning-migrations-'));
    fs.writeFileSync(
      path.join(tempMigrationsDir, '001_test_migration.sql'),
      'CREATE TABLE IF NOT EXISTS migration_test (id INTEGER PRIMARY KEY);',
      'utf8'
    );
  });

  after(() => {
    if (tempMigrationsDir?.startsWith(os.tmpdir())) {
      fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
    }
  });

  it('ships the initial schema and quiz parity migration in the versioned set', () => {
    const versions = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== 'schema_migrations.sql')
      .map(file => path.basename(file, '.sql'));

    assert.ok(versions.length >= 14);
    assert.ok(versions.includes('001_initial_schema'));
    assert.ok(versions.includes('002_quizzes_and_attempts_parity'));
  });

  it('keeps quizzes columns and required nullability in schema.sql', () => {
    const definition = getTableDefinition(schemaSql, 'quizzes');
    const requiredColumns = [
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

    for (const column of requiredColumns) {
      assert.match(definition, new RegExp(`\\b${column}\\b`, 'i'));
    }
    assert.match(definition, /quiz_id\s+SERIAL\s+PRIMARY KEY/i);
    assert.match(definition, /title\s+VARCHAR\([^)]*\)\s+NOT NULL/i);
  });

  it('keeps quiz_attempts quiz_id required and guest user_id nullable', () => {
    const definition = getTableDefinition(schemaSql, 'quiz_attempts');

    assert.match(definition, /attempt_id\s+SERIAL\s+PRIMARY KEY/i);
    assert.match(definition, /quiz_id\s+INT\s+NOT NULL/i);
    assert.match(definition, /score\s+INT\s+NOT NULL/i);
    assert.match(definition, /nickname\s+VARCHAR\([^)]*\)/i);
    assert.doesNotMatch(definition, /user_id\s+INT\s+NOT NULL/i);
  });

  it('keeps the parity migration safe for existing guest attempts', () => {
    assert.match(paritySql, /ADD COLUMN IF NOT EXISTS nickname/i);
    assert.match(paritySql, /ALTER COLUMN user_id DROP NOT NULL/i);
    assert.match(paritySql, /DELETE FROM quiz_attempts WHERE quiz_id IS NULL/i);
    assert.match(paritySql, /ALTER COLUMN quiz_id SET NOT NULL/i);
  });

  it('keeps core operational tables in the canonical schema', () => {
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
      'media_assets'
    ];

    for (const tableName of essentialTables) {
      assert.match(
        schemaSql,
        new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${tableName}\\b`, 'i'),
        `schema.sql: thiếu bảng ${tableName}`
      );
    }
  });

  it('keeps Academy roadmap metadata in schema and safely backfills existing courses', () => {
    const definition = getTableDefinition(schemaSql, 'courses');
    assert.match(definition, /academy_roadmap\s+VARCHAR\(20\)/i);
    assert.match(definition, /academy_roadmap\s+IN\s*\('basic',\s*'toeic',\s*'ielts'\)/i);
    assert.match(academyRoadmapSql, /ADD COLUMN IF NOT EXISTS academy_roadmap/i);
    assert.match(academyRoadmapSql, /WHEN subject_id IN \(4, 5\) THEN 'basic'/i);
    assert.match(academyRoadmapSql, /idx_courses_academy_roadmap_status/i);
  });

  it('runs a pending migration once and skips it on the next pass', async () => {
    const appliedVersions = new Set();
    const client = {
      async query(sql, params = []) {
        if (/SELECT version FROM schema_migrations/i.test(sql)) {
          return { rows: [...appliedVersions].map(version => ({ version })) };
        }
        if (/INSERT INTO schema_migrations/i.test(sql)) {
          appliedVersions.add(params[0]);
        }
        return { rows: [] };
      }
    };

    const firstRun = await runPendingMigrations({
      dbClient: client,
      migrationsDir: tempMigrationsDir,
      silent: true
    });
    const secondRun = await runPendingMigrations({
      dbClient: client,
      migrationsDir: tempMigrationsDir,
      silent: true
    });

    assert.equal(firstRun.appliedCount, 1);
    assert.equal(firstRun.skippedCount, 0);
    assert.equal(secondRun.appliedCount, 0);
    assert.equal(secondRun.skippedCount, 1);
  });
});
