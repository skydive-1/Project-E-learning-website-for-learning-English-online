/**
 * Migration Runner
 * Applies pending migrations in order
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map(r => r.version));
}

async function recordMigration(client, version, name, sql, executionTimeMs) {
  const checksum = require('crypto').createHash('sha256').update(sql).digest('hex');
  await client.query(
    `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (version) DO UPDATE SET
       name = EXCLUDED.name,
       checksum = EXCLUDED.checksum,
       execution_time_ms = EXCLUDED.execution_time_ms,
       applied_at = CURRENT_TIMESTAMP`,
    [version, name, checksum, executionTimeMs]
  );
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migration table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);
    `);

    const appliedMigrations = await getAppliedMigrations(client);
    console.log(`Already applied migrations: ${appliedMigrations.size}`);

    // Define migrations in order
    const migrations = [
      {
        version: '001',
        name: 'initial_schema',
        sql: fs.readFileSync(path.join(__dirname, '001_initial_schema.sql'), 'utf8')
      },
      {
        version: '002',
        name: 'add_courses_columns',
        sql: `
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(255);
          ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
        `
      },
      {
        version: '003',
        name: 'add_lessons_columns',
        sql: `
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS speaking_sentences TEXT DEFAULT '';
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS speaking_questions TEXT DEFAULT '';
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pdf_version INT DEFAULT 1;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255) DEFAULT NULL;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT NULL;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `
      },
      // ... more migrations can be added here
    ];

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.version)) {
        console.log(`Skipping ${migration.version} - ${migration.name} (already applied)`);
        continue;
      }

      console.log(`Applying ${migration.version} - ${migration.name}...`);
      const startTime = Date.now();
      
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        const executionTime = Date.now() - startTime;
        
        await recordMigration(client, migration.version, migration.name, migration.sql, executionTime);
        await client.query('COMMIT');
        
        console.log(`✅ Applied ${migration.version} - ${migration.name} (${executionTime}ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${migration.version}:`, err.message);
        throw err;
      }
    }

    console.log('✅ All migrations applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();