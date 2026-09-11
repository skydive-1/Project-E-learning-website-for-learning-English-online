'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');

const assertSafeTriggerOrder = (source, sourceName) => {
  const lessonsDrop = source.indexOf('DROP TRIGGER IF EXISTS trg_lessons_sync_media_asset ON lessons');
  const materialsDrop = source.indexOf('DROP TRIGGER IF EXISTS trg_lesson_materials_sync_media_asset ON lesson_materials');
  const lessonsAlter = source.indexOf('ALTER TABLE lessons ALTER COLUMN storage_bucket TYPE VARCHAR(255)');
  const materialsAlter = source.indexOf('ALTER TABLE lesson_materials ALTER COLUMN storage_bucket TYPE VARCHAR(255)');
  const lessonsCreate = source.indexOf('CREATE TRIGGER trg_lessons_sync_media_asset');
  const materialsCreate = source.indexOf('CREATE TRIGGER trg_lesson_materials_sync_media_asset');

  assert.ok(lessonsDrop >= 0, `${sourceName}: thiếu DROP trigger lessons`);
  assert.ok(materialsDrop >= 0, `${sourceName}: thiếu DROP trigger lesson_materials`);
  assert.ok(lessonsDrop < lessonsAlter, `${sourceName}: phải DROP trigger lessons trước ALTER TYPE`);
  assert.ok(materialsDrop < materialsAlter, `${sourceName}: phải DROP trigger lesson_materials trước ALTER TYPE`);
  assert.ok(lessonsAlter < lessonsCreate, `${sourceName}: phải tạo lại trigger lessons sau ALTER TYPE`);
  assert.ok(materialsAlter < materialsCreate, `${sourceName}: phải tạo lại trigger lesson_materials sau ALTER TYPE`);
};

test('startup schema synchronization delegates to the versioned migration runner', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src/config/database.js'), 'utf8');
  assert.match(
    source,
    /const\s+\{\s*runPendingMigrations\s*\}\s*=\s*require\(['"]\.\.\/utils\/migrationRunner['"]\)/,
    'database.js: thiếu versioned migration runner'
  );
  assert.match(
    source,
    /await\s+runPendingMigrations\(\{\s*dbClient:\s*client\s*\}\)/,
    'database.js: migration runner phải dùng cùng startup database client'
  );
});

test('standalone R2 migration is safe to rerun when media triggers already exist', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'migrations/20260903_cloudflare_r2_media_assets.sql'),
    'utf8'
  );
  assertSafeTriggerOrder(source, '20260903_cloudflare_r2_media_assets.sql');
});
