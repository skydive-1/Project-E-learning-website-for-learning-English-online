-- Prevent YouTube lessons from entering the lifecycle table for binary media.
--
-- The previous trigger treated a YouTube URL as an object key while preserving
-- storage_provider='youtube'. media_assets intentionally accepts only managed
-- R2/Supabase objects and supported legacy/external objects, so PostgreSQL
-- rejected the row and rolled back the entire course transaction.

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
    -- YouTube is a streamed external source, not an object managed by our
    -- R2/Supabase lifecycle. The lesson URL remains canonical on lessons.
    IF LOWER(COALESCE(NEW.content_type, '')) = 'youtube'
       OR LOWER(COALESCE(NEW.storage_provider, '')) = 'youtube' THEN
      NEW.media_asset_id := NULL;
      RETURN NEW;
    END IF;

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

COMMENT ON FUNCTION sync_media_asset_reference() IS
  'Syncs managed media references while leaving YouTube lessons outside the binary asset lifecycle.';
