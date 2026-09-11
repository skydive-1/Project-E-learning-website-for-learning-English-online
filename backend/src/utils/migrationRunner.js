/**
 * Versioned Migration Runner
 * Transactional, idempotent, with checksum tracking and rollback on failure.
 *
 * Authors:
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');

const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Ensure schema_migrations tracking table exists
 */
async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(120) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64) NOT NULL,
      execution_time_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);
  `);
}

/**
 * Get all previously applied migration versions
 */
async function getAppliedMigrations(client) {
  const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  return new Set(res.rows.map(r => r.version));
}

/**
 * Calculate SHA-256 checksum of SQL content
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

/**
 * Clean outer transaction statements if present, as the runner manages transactions
 */
function sanitizeMigrationSql(sql) {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/i, '')
    .replace(/\s*COMMIT\s*;\s*$/i, '');
}

/**
 * Run all pending migrations in alphabetical order
 * @param {Object} options
 * @param {string} [options.migrationsDir]
 * @param {Object} [options.dbClient] - optional existing pg client
 * @param {boolean} [options.silent] - suppress console output
 */
async function runPendingMigrations(options = {}) {
  const migrationsDir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR;
  const silent = Boolean(options.silent);
  const externalClient = options.dbClient;

  const client = externalClient || await pool.connect();
  const summary = {
    appliedCount: 0,
    appliedList: [],
    skippedCount: 0,
    totalAvailable: 0,
  };

  try {
    await ensureMigrationTable(client);
    const appliedVersions = await getAppliedMigrations(client);

    if (!fs.existsSync(migrationsDir)) {
      if (!silent) console.warn(`[Migrations] Directory not found: ${migrationsDir}`);
      return summary;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && f !== 'schema_migrations.sql')
      .sort();

    summary.totalAvailable = files.length;

    for (const file of files) {
      const version = path.basename(file, '.sql');
      if (appliedVersions.has(version)) {
        summary.skippedCount++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const rawSql = fs.readFileSync(filePath, 'utf8');
      const sanitizedSql = sanitizeMigrationSql(rawSql);
      const checksum = calculateChecksum(rawSql);
      const startTime = Date.now();

      if (!silent) {
        console.log(`[Migrations] Applying ${file}...`);
      }

      try {
        await client.query('BEGIN');
        await client.query(sanitizedSql);
        const executionTimeMs = Date.now() - startTime;

        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (version) DO UPDATE SET
             checksum = EXCLUDED.checksum,
             execution_time_ms = EXCLUDED.execution_time_ms,
             applied_at = CURRENT_TIMESTAMP`,
          [version, file, checksum, executionTimeMs]
        );

        await client.query('COMMIT');

        summary.appliedCount++;
        summary.appliedList.push({ version, file, executionTimeMs });
        if (!silent) {
          console.log(`[Migrations] ✅ Applied ${file} (${executionTimeMs}ms)`);
        }
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] ❌ FAILED on ${file}: ${err.message}`);
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    if (!silent && summary.appliedCount > 0) {
      console.log(`[Migrations] Finished: ${summary.appliedCount} new migrations applied, ${summary.skippedCount} skipped.`);
    }

    return summary;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
}

// Allow direct CLI execution: node src/utils/migrationRunner.js
if (require.main === module) {
  runPendingMigrations()
    .then(summary => {
      console.log('Migration runner finished:', summary);
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}

module.exports = {
  runPendingMigrations,
  ensureMigrationTable,
  getAppliedMigrations,
  calculateChecksum
};
