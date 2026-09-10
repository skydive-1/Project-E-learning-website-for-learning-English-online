/**
 * Migration Version Table Schema
 * Run this once to create the migration tracking table
 */

-- Migration version tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Function to check if migration has been applied
CREATE OR REPLACE FUNCTION is_migration_applied(p_version VARCHAR)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = p_version);
$$;

-- Function to record migration
CREATE OR REPLACE FUNCTION record_migration(p_version VARCHAR, p_name VARCHAR, p_checksum VARCHAR, p_execution_time_ms INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
  VALUES (p_version, p_name, p_checksum, p_execution_time_ms)
  ON CONFLICT (version) DO UPDATE SET
    name = EXCLUDED.name,
    checksum = EXCLUDED.checksum,
    execution_time_ms = EXCLUDED.execution_time_ms,
    applied_at = CURRENT_TIMESTAMP;
END;
$$;

-- Function to get pending migrations
CREATE OR REPLACE FUNCTION get_pending_migrations()
RETURNS TABLE(version VARCHAR, name VARCHAR) LANGUAGE plpgsql AS $$
DECLARE
  all_migrations CONSTANT TEXT[][] := ARRAY[
    -- Format: [version, name, sql]
    ['001', 'initial_schema', ''],
    ['002', 'add_courses_columns', ''],
    ['003', 'add_lessons_columns', ''],
    ['004', 'add_sections_columns', ''],
    ['010', 'add_users_columns', ''],
    ['011', 'add_user_progress_columns', ''],
    ['012', 'add_quizzes_columns', ''],
    ['013', 'add_questions_columns', ''],
    ['014', 'add_ai_chat_columns', ''],
    ['015', 'add_lesson_comments_columns', ''],
    ['020', 'create_lesson_comments_table', ''],
    ['021', 'create_course_discussions_tables', ''],
    ['022', 'create_instructor_policy_agreements', ''],
    ['023', 'create_learning_ss_table', ''],
    ['024', 'create_lesson_subtitles_table', ''],
    ['025', 'create_lesson_materials_table', ''],
    ['026', 'create_pdf_notes_table', ''],
    ['027', 'create_pending_media_uploads_table', ''],
    ['028', 'create_failed_storage_deletions_table', ''],
    ['030', 'create_media_assets_table', ''],
    ['031', 'create_user_token_limits_table', ''],
    ['032', 'create_ai_question_quotas_table', ''],
    ['033', 'create_ai_usage_events_table', ''],
    ['034', 'create_ai_usage_daily_history_tables', ''],
    ['035', 'create_ai_model_rate_limit_settings', ''],
    ['036', 'create_ai_rate_limit_discrepancies_table', ''],
    ['037', 'create_ai_provider_incidents_table', '']
  ];
BEGIN
  RETURN QUERY
  SELECT m[1]::VARCHAR, m[2]::VARCHAR
  FROM unnest(all_migrations) AS m
  WHERE NOT is_migration_applied(m[1]::VARCHAR);
END;
$$;