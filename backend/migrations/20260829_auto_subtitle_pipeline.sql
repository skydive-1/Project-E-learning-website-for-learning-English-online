-- Persist asynchronous subtitle jobs. Generation starts after instructor media
-- is committed instead of being delayed until the first student view.

ALTER TABLE lesson_subtitles
  ADD COLUMN IF NOT EXISTS subtitle_status VARCHAR(20) NOT NULL DEFAULT 'ready';

ALTER TABLE lesson_subtitles
  ADD COLUMN IF NOT EXISTS source_content_url TEXT;

UPDATE lesson_subtitles
SET subtitle_status = 'ready'
WHERE subtitle_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_subtitles_processing_status
  ON lesson_subtitles(subtitle_status)
  WHERE subtitle_status IN ('pending', 'processing');
