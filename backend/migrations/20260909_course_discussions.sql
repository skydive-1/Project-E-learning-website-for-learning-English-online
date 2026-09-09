BEGIN;

CREATE TABLE IF NOT EXISTS course_discussions (
  discussion_id BIGSERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  ai_response TEXT,
  video_timestamp_seconds INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'resolved')),
  student_unread BOOLEAN NOT NULL DEFAULT FALSE,
  instructor_unread BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_course_discussions_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT chk_course_discussions_content_nonempty CHECK (length(btrim(content)) > 0),
  CONSTRAINT chk_course_discussions_video_time CHECK (
    video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0
  )
);

CREATE TABLE IF NOT EXISTS course_discussion_replies (
  reply_id BIGSERIAL PRIMARY KEY,
  discussion_id BIGINT NOT NULL REFERENCES course_discussions(discussion_id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  ai_response TEXT,
  video_timestamp_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_course_discussion_replies_content_nonempty CHECK (length(btrim(content)) > 0),
  CONSTRAINT chk_course_discussion_replies_video_time CHECK (video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0)
);

-- Tương thích với môi trường đã chạy phiên bản migration trước đó.
ALTER TABLE course_discussion_replies
  ADD COLUMN IF NOT EXISTS ai_response TEXT,
  ADD COLUMN IF NOT EXISTS video_timestamp_seconds INTEGER;

CREATE TABLE IF NOT EXISTS course_announcements (
  announcement_id BIGSERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  instructor_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_course_announcements_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT chk_course_announcements_content_nonempty CHECK (length(btrim(content)) > 0)
);

CREATE TABLE IF NOT EXISTS course_announcement_reads (
  announcement_id BIGINT NOT NULL REFERENCES course_announcements(announcement_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_discussions_student_activity
  ON course_discussions(student_id, course_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussions_instructor_queue
  ON course_discussions(course_id, status, instructor_unread, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussions_lesson
  ON course_discussions(lesson_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_thread
  ON course_discussion_replies(discussion_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_course_announcements_course_created
  ON course_announcements(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_announcement_reads_user
  ON course_announcement_reads(user_id, read_at DESC);

COMMIT;
