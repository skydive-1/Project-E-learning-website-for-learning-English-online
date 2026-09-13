-- Keep long-running DASH packaging outside the upload HTTP request while
-- retaining the pending-upload ownership and cleanup contract.
ALTER TABLE pending_media_uploads
  DROP CONSTRAINT IF EXISTS pending_media_uploads_status_check;

ALTER TABLE pending_media_uploads
  ADD CONSTRAINT pending_media_uploads_status_check
  CHECK (status IN ('PROCESSING', 'PENDING', 'CLAIMING', 'CLEANING', 'COMMITTED', 'FAILED', 'EXPIRED'));

ALTER TABLE pending_media_uploads
  ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(50),
  ADD COLUMN IF NOT EXISTS processing_error_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS processing_error_message VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_processing
  ON pending_media_uploads(status, updated_at)
  WHERE status IN ('PROCESSING', 'FAILED');
