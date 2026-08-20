-- ==============================================================================
-- MIGRATION: 20260820_durable_media_storage_r2_fix.sql
-- PURPOSE: Corrective forward migration for Durable Media Pipeline (R2.1)
-- AUTHORS: LÊ ĐÌNH CHƯƠNG (Database Administrator) & NGUYỄN THANH LIÊM (Backend Developer)
-- ==============================================================================

BEGIN;

-- 1. DROP INVALID HARDCODED DEFAULTS FROM R1 ON lessons TABLE
ALTER TABLE lessons ALTER COLUMN storage_provider DROP DEFAULT;
ALTER TABLE lessons ALTER COLUMN storage_bucket DROP DEFAULT;
ALTER TABLE lessons ALTER COLUMN mime_type DROP DEFAULT;
ALTER TABLE lessons ALTER COLUMN media_status DROP DEFAULT;

-- 2. DROP INVALID HARDCODED DEFAULTS FROM R1 ON lesson_materials TABLE (IF EXISTS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_materials') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_materials' AND column_name = 'storage_provider') THEN
      ALTER TABLE lesson_materials ALTER COLUMN storage_provider DROP DEFAULT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_materials' AND column_name = 'storage_bucket') THEN
      ALTER TABLE lesson_materials ALTER COLUMN storage_bucket DROP DEFAULT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_materials' AND column_name = 'mime_type') THEN
      ALTER TABLE lesson_materials ALTER COLUMN mime_type DROP DEFAULT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_materials' AND column_name = 'media_status') THEN
      ALTER TABLE lesson_materials ALTER COLUMN media_status DROP DEFAULT;
    END IF;
  END IF;
END $$;

-- 3. CREATE pending_media_uploads TABLE FOR ATOMIC CLAIMING & TTL CLEANUP
CREATE TABLE IF NOT EXISTS pending_media_uploads (
  upload_id UUID PRIMARY KEY,
  instructor_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
  storage_bucket VARCHAR(50) NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLAIMING', 'CLEANING', 'COMMITTED', 'EXPIRED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  claimed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_status_expires ON pending_media_uploads(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_instructor ON pending_media_uploads(instructor_id);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_key ON pending_media_uploads(storage_key);

-- 4. CREATE failed_storage_deletions TABLE FOR RETRY QUEUE & AUDIT
CREATE TABLE IF NOT EXISTS failed_storage_deletions (
  deletion_id SERIAL PRIMARY KEY,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
  storage_bucket VARCHAR(50) NOT NULL,
  storage_key TEXT NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_RETRY' CHECK (status IN ('PENDING_RETRY', 'FAILED_PERMANENT', 'RESOLVED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_failed_storage_deletions_retry ON failed_storage_deletions(status, next_retry_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_failed_storage_deletions_object
  ON failed_storage_deletions(storage_provider, storage_bucket, storage_key);

-- 5. SAFE BACKFILL FOR lessons TABLE
-- A. Non-media lessons (quiz, text, speaking) -> Clear durable media columns to NULL
UPDATE lessons
SET storage_provider = NULL,
    storage_bucket = NULL,
    storage_key = NULL,
    mime_type = NULL,
    size_bytes = 0,
    checksum_sha256 = NULL,
    media_status = NULL
WHERE LOWER(content_type) IN ('quiz', 'text', 'speaking')
   OR (content_url IS NULL OR content_url = '');

-- B. External CDN links -> Set storage_provider = 'external' and media_status = 'READY' (EXCLUDE Supabase full URLs)
UPDATE lessons
SET storage_provider = 'external',
    storage_bucket = NULL,
    storage_key = NULL,
    media_status = 'READY'
WHERE (content_url LIKE 'http://%' OR content_url LIKE 'https://%')
  AND content_url NOT LIKE '%supabase.co%'
  AND LOWER(content_type) IN ('video', 'pdf');

-- C. Local / Unverified legacy rows -> Set media_status = 'PENDING_AUDIT'
UPDATE lessons
SET media_status = 'PENDING_AUDIT'
WHERE (content_url LIKE '/uploads/%' OR content_url LIKE 'uploads/%' OR storage_key IS NULL)
  AND LOWER(content_type) IN ('video', 'pdf')
  AND (media_status IS NULL OR media_status = 'READY')
  AND storage_provider IS DISTINCT FROM 'external';

-- 6. SAFE BACKFILL FOR lesson_materials TABLE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_materials') THEN
    UPDATE lesson_materials
    SET storage_provider = 'external',
        storage_bucket = NULL,
        storage_key = NULL,
        media_status = 'READY'
    WHERE (file_url LIKE 'http://%' OR file_url LIKE 'https://%')
      AND file_url NOT LIKE '%supabase.co%';

    UPDATE lesson_materials
    SET media_status = 'PENDING_AUDIT'
    WHERE (file_url LIKE '/uploads/%' OR file_url LIKE 'uploads/%' OR storage_key IS NULL)
      AND (media_status IS NULL OR media_status = 'READY')
      AND storage_provider IS DISTINCT FROM 'external';
  END IF;
END $$;

-- 7. RE-APPLY IDEMPOTENT CHECK CONSTRAINTS ON media_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_lessons_media_status' AND table_name = 'lessons'
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT chk_lessons_media_status
      CHECK (media_status IS NULL OR media_status IN ('READY', 'MISSING_SOURCE', 'UPLOADING', 'PROCESSING', 'FAILED', 'PENDING_AUDIT'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_materials') THEN
    ALTER TABLE lesson_materials DROP CONSTRAINT IF EXISTS chk_materials_media_status;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'chk_lesson_materials_media_status' AND table_name = 'lesson_materials'
    ) THEN
      ALTER TABLE lesson_materials ADD CONSTRAINT chk_lesson_materials_media_status
        CHECK (media_status IS NULL OR media_status IN ('READY', 'MISSING_SOURCE', 'UPLOADING', 'PROCESSING', 'FAILED', 'PENDING_AUDIT'));
    END IF;
  END IF;
END $$;

COMMIT;

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS:
-- In case of emergency rollback, execute:
-- BEGIN;
-- DROP TABLE IF EXISTS failed_storage_deletions;
-- DROP TABLE IF EXISTS pending_media_uploads;
-- ALTER TABLE lessons DROP CONSTRAINT IF EXISTS chk_lessons_media_status;
-- ALTER TABLE lesson_materials DROP CONSTRAINT IF EXISTS chk_lesson_materials_media_status;
-- COMMIT;
-- ==============================================================================
