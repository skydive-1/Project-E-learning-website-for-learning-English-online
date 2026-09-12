ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS academy_roadmap VARCHAR(20);

UPDATE courses
SET academy_roadmap = CASE
  WHEN subject_id = 1 THEN 'ielts'
  WHEN subject_id = 2 THEN 'toeic'
  WHEN subject_id IN (4, 5) THEN 'basic'
  ELSE academy_roadmap
END
WHERE academy_roadmap IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_academy_roadmap_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_academy_roadmap_check
      CHECK (academy_roadmap IN ('basic', 'toeic', 'ielts'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_courses_academy_roadmap_status
  ON courses (academy_roadmap, status);
