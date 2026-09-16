-- Migration: 20260916_enrollments_and_announcement_dismissals.sql
-- Description: Thêm bảng enrollments và course_announcement_dismissals
-- Authors:
-- - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
-- - NGUYỄN THANH LIÊM (Backend & Security Developer)

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);

CREATE TABLE IF NOT EXISTS course_announcement_dismissals (
  announcement_id INT NOT NULL REFERENCES course_announcements(announcement_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_user_id ON course_announcement_dismissals(user_id);
