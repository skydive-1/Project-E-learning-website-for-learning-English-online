-- Link pending uploads to a verified live course instead of deriving deep-links
-- from object-key text. ON DELETE SET NULL preserves the durable cleanup record.
ALTER TABLE pending_media_uploads
  ADD COLUMN IF NOT EXISTS course_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_info
    JOIN pg_attribute column_info
      ON column_info.attrelid = constraint_info.conrelid
     AND column_info.attnum = ANY(constraint_info.conkey)
    WHERE constraint_info.contype = 'f'
      AND constraint_info.conrelid = 'pending_media_uploads'::regclass
      AND column_info.attname = 'course_id'
  ) THEN
    ALTER TABLE pending_media_uploads
      ADD CONSTRAINT fk_pending_media_uploads_course
      FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill only IDs which still exist. Deleted course IDs deliberately stay NULL.
WITH candidates AS (
  SELECT upload_id,
         ((regexp_match(storage_key,
           '(^|/)courses/([^/]*-)?([0-9]{1,9})(/|$)', 'i'))[3])::INT AS parsed_course_id
  FROM pending_media_uploads
  WHERE course_id IS NULL
)
UPDATE pending_media_uploads p
SET course_id = c.course_id
FROM candidates candidate
JOIN courses c ON c.course_id = candidate.parsed_course_id
WHERE p.upload_id = candidate.upload_id;

CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_course
  ON pending_media_uploads(course_id);
