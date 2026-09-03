-- Canonical media metadata for Cloudflare R2.
-- Binary payloads remain in R2; PostgreSQL stores references and lifecycle state only.
BEGIN;

CREATE TABLE IF NOT EXISTS media_assets (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_kind VARCHAR(20) NOT NULL CHECK (media_kind IN ('video', 'pdf', 'audio', 'image', 'subtitle', 'other')),
  storage_provider VARCHAR(20) NOT NULL DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'supabase', 'external', 'legacy_local')),
  storage_bucket VARCHAR(255),
  object_key TEXT,
  original_filename VARCHAR(512),
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum_sha256 VARCHAR(64),
  status VARCHAR(30) NOT NULL DEFAULT 'UPLOADING'
    CHECK (status IN ('UPLOADING', 'PROCESSING', 'READY', 'MISSING_SOURCE', 'FAILED', 'PENDING_AUDIT', 'DELETED')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_media_assets_location CHECK (
    (storage_provider IN ('r2', 'supabase') AND storage_bucket IS NOT NULL AND object_key IS NOT NULL)
    OR storage_provider IN ('external', 'legacy_local')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_active_object
  ON media_assets(storage_provider, storage_bucket, object_key)
  WHERE deleted_at IS NULL AND object_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_kind_status ON media_assets(media_kind, status);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_by ON media_assets(created_by);
CREATE INDEX IF NOT EXISTS idx_media_assets_checksum ON media_assets(checksum_sha256) WHERE checksum_sha256 IS NOT NULL;

-- Some older installations predate lesson attachments entirely. Create the
-- compatibility table here so this migration can be applied independently of
-- application startup and earlier optional migrations.
CREATE TABLE IF NOT EXISTS lesson_materials (
  material_id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) DEFAULT 'application/pdf',
  file_size_kb INT DEFAULT 0,
  pdf_version INT DEFAULT 1,
  storage_provider VARCHAR(50) DEFAULT NULL,
  storage_bucket VARCHAR(255) DEFAULT NULL,
  storage_key TEXT DEFAULT NULL,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  size_bytes BIGINT DEFAULT 0,
  checksum_sha256 VARCHAR(64) DEFAULT NULL,
  media_status VARCHAR(30) DEFAULT NULL,
  media_asset_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL,
  uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_lesson_materials_media_status CHECK (
    media_status IS NULL OR media_status IN (
      'READY', 'UPLOADING', 'PROCESSING', 'MISSING_SOURCE',
      'FAILED', 'PENDING_AUDIT'
    )
  )
);

-- Bring an existing pre-media lesson_materials table up to the shape required
-- by the sync trigger below.
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS file_size_kb INT DEFAULT 0;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS pdf_version INT DEFAULT 1;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255) DEFAULT NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf';
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255) DEFAULT NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL;
ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL;
ALTER TABLE pending_media_uploads ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_media_asset_id ON lessons(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_media_asset_id ON lesson_materials(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_media_id ON pending_media_uploads(media_id);

ALTER TABLE pending_media_uploads ALTER COLUMN storage_provider SET DEFAULT 'r2';
ALTER TABLE failed_storage_deletions ALTER COLUMN storage_provider SET DEFAULT 'r2';

-- Các trigger UPDATE OF tham chiếu storage_bucket nên phải được gỡ trước ALTER TYPE.
-- Migration có thể chạy lại an toàn; trigger được tạo lại sau khi function sẵn sàng.
DROP TRIGGER IF EXISTS trg_lessons_sync_media_asset ON lessons;
DROP TRIGGER IF EXISTS trg_lesson_materials_sync_media_asset ON lesson_materials;
ALTER TABLE lessons ALTER COLUMN storage_bucket TYPE VARCHAR(255);
ALTER TABLE lesson_materials ALTER COLUMN storage_bucket TYPE VARCHAR(255);
ALTER TABLE pending_media_uploads ALTER COLUMN storage_bucket TYPE VARCHAR(255);
ALTER TABLE failed_storage_deletions ALTER COLUMN storage_bucket TYPE VARCHAR(255);

CREATE OR REPLACE FUNCTION infer_media_kind(p_mime TEXT, p_key TEXT)
RETURNS VARCHAR(20)
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_mime, '') LIKE 'video/%' OR COALESCE(p_key, '') ~* '\.(mp4|m4s|mpd)$' THEN 'video'
    WHEN COALESCE(p_mime, '') = 'application/pdf' OR COALESCE(p_key, '') ~* '\.pdf$' THEN 'pdf'
    WHEN COALESCE(p_mime, '') LIKE 'audio/%' OR COALESCE(p_key, '') ~* '\.(mp3|wav|ogg|m4a|aac)$' THEN 'audio'
    WHEN COALESCE(p_mime, '') LIKE 'image/%' OR COALESCE(p_key, '') ~* '\.(jpe?g|png|gif|webp|avif)$' THEN 'image'
    WHEN COALESCE(p_key, '') ~* '\.(vtt|srt)$' THEN 'subtitle'
    ELSE 'other'
  END::VARCHAR(20)
$$;

CREATE OR REPLACE FUNCTION sync_media_asset_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_media_id UUID;
  v_provider TEXT;
  v_bucket TEXT;
  v_key TEXT;
  v_mime TEXT;
  v_size BIGINT;
  v_checksum TEXT;
  v_status TEXT;
  v_filename TEXT;
  v_created_by INT;
BEGIN
  IF TG_TABLE_NAME = 'lessons' THEN
    v_provider := CASE WHEN NEW.storage_provider = 'local' THEN 'legacy_local'
      ELSE COALESCE(NEW.storage_provider, CASE WHEN NEW.content_url LIKE '/uploads/%' THEN 'legacy_local' END) END;
    v_bucket := NEW.storage_bucket;
    v_key := COALESCE(NEW.storage_key, NULLIF(NEW.content_url, ''));
    v_mime := COALESCE(NEW.mime_type, CASE WHEN NEW.content_type = 'pdf' THEN 'application/pdf' WHEN NEW.content_type = 'video' THEN 'video/mp4' END);
    v_size := COALESCE(NEW.size_bytes, 0);
    v_checksum := NEW.checksum_sha256;
    v_status := COALESCE(NEW.media_status, 'PENDING_AUDIT');
    v_filename := NEW.title;
  ELSIF TG_TABLE_NAME = 'lesson_materials' THEN
    v_provider := CASE WHEN NEW.storage_provider = 'local' THEN 'legacy_local'
      ELSE COALESCE(NEW.storage_provider, CASE WHEN NEW.file_url LIKE '/uploads/%' THEN 'legacy_local' END) END;
    v_bucket := NEW.storage_bucket;
    v_key := COALESCE(NEW.storage_key, NULLIF(NEW.file_url, ''));
    v_mime := COALESCE(NEW.mime_type, NEW.file_type, 'application/pdf');
    v_size := COALESCE(NEW.size_bytes, COALESCE(NEW.file_size_kb, 0)::BIGINT * 1024);
    v_checksum := NEW.checksum_sha256;
    v_status := COALESCE(NEW.media_status, 'PENDING_AUDIT');
    v_filename := NEW.file_name;
    v_created_by := NEW.uploaded_by;
  ELSE
    RETURN NEW;
  END IF;

  IF v_key IS NULL OR v_provider IS NULL OR v_mime IS NULL THEN
    NEW.media_asset_id := NULL;
    RETURN NEW;
  END IF;

  SELECT media_id INTO v_media_id
  FROM media_assets
  WHERE storage_provider = v_provider
    AND storage_bucket IS NOT DISTINCT FROM v_bucket
    AND object_key = v_key
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_media_id IS NULL THEN
    INSERT INTO media_assets (
      media_kind, storage_provider, storage_bucket, object_key, original_filename,
      mime_type, size_bytes, checksum_sha256, status, created_by
    ) VALUES (
      infer_media_kind(v_mime, v_key), v_provider, v_bucket, v_key, v_filename,
      v_mime, v_size, v_checksum, v_status, v_created_by
    ) RETURNING media_id INTO v_media_id;
  ELSE
    UPDATE media_assets
    SET mime_type = v_mime,
        size_bytes = GREATEST(size_bytes, v_size),
        checksum_sha256 = COALESCE(v_checksum, checksum_sha256),
        status = v_status,
        original_filename = COALESCE(original_filename, v_filename),
        updated_at = CURRENT_TIMESTAMP
    WHERE media_id = v_media_id;
  END IF;

  NEW.media_asset_id := v_media_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lessons_sync_media_asset
BEFORE INSERT OR UPDATE OF content_url, storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
ON lessons FOR EACH ROW EXECUTE FUNCTION sync_media_asset_reference();

CREATE TRIGGER trg_lesson_materials_sync_media_asset
BEFORE INSERT OR UPDATE OF file_url, storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
ON lesson_materials FOR EACH ROW EXECUTE FUNCTION sync_media_asset_reference();

-- Backfill existing rows without moving binary content.
UPDATE lessons SET storage_key = storage_key WHERE storage_key IS NOT NULL OR content_url LIKE '/uploads/%';
UPDATE lesson_materials SET storage_key = storage_key WHERE storage_key IS NOT NULL OR file_url LIKE '/uploads/%';

COMMENT ON TABLE media_assets IS 'Canonical metadata only. Binary video/PDF/audio/image content is stored outside PostgreSQL in Cloudflare R2.';
COMMENT ON COLUMN lessons.storage_key IS 'Deprecated compatibility mirror; canonical metadata is media_assets via media_asset_id.';
COMMENT ON COLUMN lesson_materials.storage_key IS 'Deprecated compatibility mirror; canonical metadata is media_assets via media_asset_id.';

COMMIT;
