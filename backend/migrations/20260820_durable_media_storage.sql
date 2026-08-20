-- Migration: 20260820_durable_media_storage.sql
-- Description: Bổ sung các trường metadata lưu trữ bền vững (Supabase Private Storage) cho bài học và tài liệu đính kèm
-- Task: TASK-DURABLE-LESSON-MEDIA-PIPELINE-01

-- 1. Bổ sung các trường lưu trữ bền vững cho bảng lessons
ALTER TABLE lessons 
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(50) DEFAULT 'videos',
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'video/mp4',
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT 'READY';

-- 2. Bổ sung các trường lưu trữ bền vững cho bảng lesson_materials
ALTER TABLE lesson_materials
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(50) DEFAULT 'documents',
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT 'READY';

-- 3. Tạo chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_lessons_storage_key ON lessons(storage_key);
CREATE INDEX IF NOT EXISTS idx_lessons_media_status ON lessons(media_status);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_storage_key ON lesson_materials(storage_key);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_media_status ON lesson_materials(media_status);
