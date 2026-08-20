-- Migration: 20260820_durable_media_storage.sql
-- Description: Bổ sung các trường metadata lưu trữ bền vững (Supabase Private Storage) cho bài học và tài liệu đính kèm
-- Task: TASK-DURABLE-VIDEO-MEDIA-MERGE-BLOCKERS-R2 / TASK-DURABLE-LESSON-MEDIA-PIPELINE-01
-- Phụ trách: LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)

BEGIN;

-- 1. Bổ sung các trường lưu trữ bền vững cho bảng lessons (Không mặc định ép kiểu Supabase/video cho bài học text/quiz/speaking)
ALTER TABLE lessons 
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;

-- 2. Bổ sung các trường lưu trữ bền vững cho bảng lesson_materials
ALTER TABLE lesson_materials
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;

-- 3. Cập nhật ràng buộc (Constraint) hợp lệ cho media_status (Thực hiện an toàn nếu constraint chưa tồn tại)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_lessons_media_status'
  ) THEN
    ALTER TABLE lessons 
      ADD CONSTRAINT chk_lessons_media_status 
      CHECK (media_status IS NULL OR media_status IN ('READY', 'UPLOADING', 'PROCESSING', 'MISSING_SOURCE', 'FAILED', 'PENDING_AUDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_lesson_materials_media_status'
  ) THEN
    ALTER TABLE lesson_materials 
      ADD CONSTRAINT chk_lesson_materials_media_status 
      CHECK (media_status IS NULL OR media_status IN ('READY', 'UPLOADING', 'PROCESSING', 'MISSING_SOURCE', 'FAILED', 'PENDING_AUDIT'));
  END IF;
END $$;

-- 4. Tạo chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_lessons_storage_key ON lessons(storage_key);
CREATE INDEX IF NOT EXISTS idx_lessons_media_status ON lessons(media_status);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_storage_key ON lesson_materials(storage_key);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_media_status ON lesson_materials(media_status);

COMMIT;

-- ============================================================================
-- HƯỚNG DẪN ROLLBACK (ROLLBACK INSTRUCTIONS):
--
-- BEGIN;
-- ALTER TABLE lessons DROP CONSTRAINT IF EXISTS chk_lessons_media_status;
-- ALTER TABLE lesson_materials DROP CONSTRAINT IF EXISTS chk_lesson_materials_media_status;
-- DROP INDEX IF EXISTS idx_lessons_storage_key;
-- DROP INDEX IF EXISTS idx_lessons_media_status;
-- DROP INDEX IF EXISTS idx_lesson_materials_storage_key;
-- DROP INDEX IF EXISTS idx_lesson_materials_media_status;
-- ALTER TABLE lessons
--   DROP COLUMN IF EXISTS storage_provider,
--   DROP COLUMN IF EXISTS storage_bucket,
--   DROP COLUMN IF EXISTS storage_key,
--   DROP COLUMN IF EXISTS mime_type,
--   DROP COLUMN IF EXISTS size_bytes,
--   DROP COLUMN IF EXISTS checksum_sha256,
--   DROP COLUMN IF EXISTS media_status;
-- ALTER TABLE lesson_materials
--   DROP COLUMN IF EXISTS storage_provider,
--   DROP COLUMN IF EXISTS storage_bucket,
--   DROP COLUMN IF EXISTS storage_key,
--   DROP COLUMN IF EXISTS mime_type,
--   DROP COLUMN IF EXISTS size_bytes,
--   DROP COLUMN IF EXISTS checksum_sha256,
--   DROP COLUMN IF EXISTS media_status;
-- COMMIT;
-- ============================================================================
