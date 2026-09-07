BEGIN;

ALTER TABLE lesson_subtitles
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80);

ALTER TABLE lesson_subtitles
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMIT;
