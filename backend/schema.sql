-- =====================================================================
-- E-LEARN ACADEMY DATABASE SCHEMA & INITIAL SEED DATA
-- Cấu trúc cơ sở dữ liệu hoàn chỉnh cho dự án E-Learn Academy
-- Thực thi thủ công trên Supabase SQL Editor trước khi khởi chạy server
-- =====================================================================

-- 1. Tạo bảng Roles (Vai trò người dùng)
CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

-- Seed vai trò mặc định
INSERT INTO roles (role_id, role_name) 
VALUES (1, 'Admin'), (2, 'Instructor'), (3, 'Student') 
ON CONFLICT (role_id) DO UPDATE SET role_name = EXCLUDED.role_name;

-- 2. Tạo bảng Users (Người dùng)
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(15) UNIQUE,
  role_id INT NOT NULL DEFAULT 3,
  gender VARCHAR(10) CHECK (gender IN ('Male','Female','Other')),
  profile_picture_url VARCHAR(255),
  supabase_uid UUID UNIQUE,
  longest_streak INTEGER DEFAULT 0,
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- Canonical metadata cho mọi media; payload nhị phân luôn nằm ngoài PostgreSQL.
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
  status VARCHAR(30) NOT NULL DEFAULT 'UPLOADING' CHECK (status IN ('UPLOADING', 'PROCESSING', 'READY', 'MISSING_SOURCE', 'FAILED', 'PENDING_AUDIT', 'DELETED')),
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_active_object ON media_assets(storage_provider, storage_bucket, object_key) WHERE deleted_at IS NULL AND object_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_kind_status ON media_assets(media_kind, status);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL;

-- 3. Tạo bảng Subjects (Môn học)
CREATE TABLE IF NOT EXISTS subjects (
  subject_id SERIAL PRIMARY KEY,
  subject_name VARCHAR(100) NOT NULL UNIQUE,
  credits INT NOT NULL DEFAULT 3
);

-- Seed các môn học mẫu
INSERT INTO subjects (subject_id, subject_name, credits) 
VALUES 
  (1, 'IELTS Masterclass', 4),
  (2, 'TOEIC Prep', 3),
  (3, 'Business English', 3),
  (4, 'General English Communication', 2),
  (5, 'English Grammar Essentials', 2)
ON CONFLICT (subject_id) DO UPDATE 
SET subject_name = EXCLUDED.subject_name, credits = EXCLUDED.credits;

-- 4. Tạo bảng Courses (Khóa học)
CREATE TABLE IF NOT EXISTS courses (
  course_id SERIAL PRIMARY KEY,
  subject_id INT,
  course_name VARCHAR(255) NOT NULL,
  description TEXT,
  academy_roadmap VARCHAR(20) CHECK (academy_roadmap IN ('basic', 'toeic', 'ielts')),
  instructor_id INT NOT NULL,
  thumbnail_url VARCHAR(255),
  thumbnail_media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_course_instructor FOREIGN KEY (instructor_id) REFERENCES users(user_id),
  CONSTRAINT fk_course_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

-- 5. Tạo bảng Sections (Chương học)
CREATE TABLE IF NOT EXISTS sections (
  section_id SERIAL PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_section_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- 6. Tạo bảng Lessons (Bài học)
CREATE TABLE IF NOT EXISTS lessons (
  lesson_id SERIAL PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(20) NOT NULL, -- video, pdf, quiz, text
  content_url TEXT,
  order_index INT NOT NULL,
  pdf_version INT DEFAULT 1,
  speaking_sentences TEXT DEFAULT '',
  speaking_questions TEXT DEFAULT '',
  storage_provider VARCHAR(50) DEFAULT NULL,
  storage_bucket VARCHAR(255) DEFAULT NULL,
  storage_key TEXT DEFAULT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  size_bytes BIGINT DEFAULT 0,
  checksum_sha256 VARCHAR(64) DEFAULT NULL,
  media_status VARCHAR(30) DEFAULT NULL,
  media_asset_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lesson_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE,
  CONSTRAINT chk_lessons_media_status CHECK (media_status IS NULL OR media_status IN ('READY', 'UPLOADING', 'PROCESSING', 'MISSING_SOURCE', 'FAILED', 'PENDING_AUDIT'))
);

-- 7. Tạo bảng User Progress (Tiến độ học tập)
CREATE TABLE IF NOT EXISTS user_progress (
  progress_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id INT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  CONSTRAINT uq_user_lesson UNIQUE (user_id, lesson_id)
);

-- 8. Tạo bảng Quizzes (Đề thi trắc nghiệm)
CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id SERIAL PRIMARY KEY,
  course_id INT, -- NULL đối với đề thi tự luyện tự do
  lesson_id INT, -- NULL nếu không gắn với bài học cụ thể
  title VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty VARCHAR(50) DEFAULT 'Medium',
  time_limit INT DEFAULT 10,
  is_private BOOLEAN DEFAULT FALSE,     -- Quiz ẩn hoặc công khai
  pin_code VARCHAR(20) DEFAULT NULL,    -- Mã PIN để vào quiz private
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiz_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE
);

-- 9. Tạo bảng Questions (Câu hỏi trắc nghiệm liên kết với quizzes)
CREATE TABLE IF NOT EXISTS questions (
  question_id SERIAL PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT, -- A, B, C, D hoặc câu phát âm / đáp án mẫu (rỗng với open_cloze/writing)
  explanation TEXT,
  question_type VARCHAR(50) DEFAULT 'multiple_choice',
  audio_url TEXT,
  passage_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  CONSTRAINT chk_question_type CHECK (question_type IS NULL OR question_type IN ('multiple_choice', 'writing', 'pronunciation', 'open_cloze', 'listening', 'reading'))
);

-- 10. Tạo bảng Quiz Attempts (Lịch sử làm bài trắc nghiệm)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  attempt_id SERIAL PRIMARY KEY,
  user_id INT, -- Cho phép NULL đối với học viên vãng lai làm bài tự do
  quiz_id INT NOT NULL,
  score INT NOT NULL, -- Điểm số (0 - 100)
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  nickname VARCHAR(100),
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- 11. Tạo bảng AI Chat (Lịch sử chat hỗ trợ AI)
CREATE TABLE IF NOT EXISTS ai_chat (
  ai_chat SERIAL PRIMARY KEY,
  student_id INT NOT NULL,
  title TEXT NOT NULL,
  sender_type VARCHAR(50) NOT NULL, -- user hoặc bot
  lesson_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_chat_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE
);

-- 12. Tạo bảng Quản lý Hạn mức Token (user_token_limits)
CREATE TABLE IF NOT EXISTS user_token_limits (
  token_limit_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  max_tokens INT NOT NULL CHECK (max_tokens >= 0) DEFAULT 6000,
  used_tokens INT NOT NULL CHECK (used_tokens >= 0) DEFAULT 0,
  remaining_tokens INT GENERATED ALWAYS AS (max_tokens - used_tokens) STORED,
  reset_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12b. Quota câu hỏi AI — reset cố định lúc 00:00 giờ Việt Nam (UTC+7) mỗi ngày
CREATE TABLE IF NOT EXISTS ai_question_quotas (
  user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  used_questions INT NOT NULL DEFAULT 0 CHECK (used_questions >= 0),
  window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_question_quotas_window
  ON ai_question_quotas(window_started_at);

-- 12c. Bảng ghi nhận token thực tế từ Gemini API
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_date
  ON ai_usage_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_purpose_date
  ON ai_usage_events(purpose, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_model_date
  ON ai_usage_events(model, created_at);

-- 12d. Dữ liệu usage lịch sử tổng hợp nhập từ dashboard nhà cung cấp.
-- Không gán user_id/purpose vì nguồn Google AI Studio chỉ có project/model/ngày.
CREATE TABLE IF NOT EXISTS ai_usage_daily_model_history (
  usage_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_ai_studio',
  source_project TEXT NOT NULL,
  source_project_ref TEXT NOT NULL,
  model TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens BIGINT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, source_project_ref, usage_date, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_model_history_date
  ON ai_usage_daily_model_history(usage_date);

CREATE TABLE IF NOT EXISTS ai_usage_daily_project_history (
  usage_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_ai_studio',
  source_project TEXT NOT NULL,
  source_project_ref TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0 CHECK (total_requests >= 0),
  successful_requests INTEGER NOT NULL DEFAULT 0 CHECK (successful_requests >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  success_rate NUMERIC(10, 9) CHECK (success_rate >= 0 AND success_rate <= 1),
  errors_by_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, source_project_ref, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_project_history_date
  ON ai_usage_daily_project_history(usage_date);

-- 12e. Hạn mức Gemini do admin xác nhận từ Google AI Studio
-- Không có default cap để tránh coi giá trị gợi ý là hạn mức thật.
CREATE TABLE IF NOT EXISTS ai_model_rate_limit_settings (
  model TEXT PRIMARY KEY,
  rpm_cap INTEGER NOT NULL CHECK (rpm_cap > 0),
  tpm_cap INTEGER NOT NULL CHECK (tpm_cap > 0),
  rpd_cap INTEGER NOT NULL CHECK (rpd_cap > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INT REFERENCES users(user_id) ON DELETE SET NULL
);

-- 12f. Tín hiệu 429 cho thấy cap cấu hình có thể lệch so với quota thật.
CREATE TABLE IF NOT EXISTS ai_rate_limit_discrepancies (
  model TEXT NOT NULL,
  dimension VARCHAR(3) NOT NULL CHECK (dimension IN ('rpm', 'tpm', 'rpd')),
  configured_cap INTEGER NOT NULL CHECK (configured_cap > 0),
  observed_usage BIGINT NOT NULL DEFAULT 0,
  provider_limit BIGINT,
  raw_detail JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (model, dimension)
);

-- 13. Tạo bảng Lesson Comments (Bình luận bài học)
CREATE TABLE IF NOT EXISTS lesson_comments (
  comment_id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  parent_id INT REFERENCES lesson_comments(comment_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tạo bảng Comment Upvotes (Thả tim/Upvote câu trả lời)
CREATE TABLE IF NOT EXISTS comment_upvotes (
  comment_id INT NOT NULL REFERENCES lesson_comments(comment_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson_id ON lesson_comments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent_id ON lesson_comments(parent_id);

-- 14.1. Hỏi đáp riêng Học viên - Giảng viên và thông báo khóa học
CREATE TABLE IF NOT EXISTS course_discussions (
  discussion_id BIGSERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  ai_response TEXT,
  video_timestamp_seconds INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'resolved')),
  student_unread BOOLEAN NOT NULL DEFAULT FALSE,
  instructor_unread BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_course_discussions_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT chk_course_discussions_content_nonempty CHECK (length(btrim(content)) > 0),
  CONSTRAINT chk_course_discussions_video_time CHECK (video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0)
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

CREATE INDEX IF NOT EXISTS idx_course_discussions_student_activity ON course_discussions(student_id, course_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussions_instructor_queue ON course_discussions(course_id, status, instructor_unread, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussions_lesson ON course_discussions(lesson_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_thread ON course_discussion_replies(discussion_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_course_announcements_course_created ON course_announcements(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_announcement_reads_user ON course_announcement_reads(user_id, read_at DESC);

-- 15. Tạo bảng Thỏa thuận Bản quyền Giảng viên (instructor_policy_agreements)
CREATE TABLE IF NOT EXISTS instructor_policy_agreements (
  agreement_id SERIAL PRIMARY KEY,
  instructor_id INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL,
  signature TEXT NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. Tạo bảng Phiên học rèn luyện Gamification & Heatmap (learning_ss)
CREATE TABLE IF NOT EXISTS learning_ss (
  learning_ss_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lesson_id INT REFERENCES lessons(lesson_id) ON DELETE SET NULL,
  start_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_learning_ss_user_id ON learning_ss(user_id);

-- 17. Tạo bảng Phụ đề Thông minh & Kịch bản Song ngữ (lesson_subtitles)
CREATE TABLE IF NOT EXISTS lesson_subtitles (
  subtitle_id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL UNIQUE REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  en_vtt TEXT,
  vi_vtt TEXT,
  bilingual_vtt TEXT,
  cues JSONB NOT NULL DEFAULT '[]',
  subtitle_status VARCHAR(20) NOT NULL DEFAULT 'ready',
  source_content_url TEXT,
  error_code VARCHAR(80),
  error_message TEXT,
  is_auto_generated_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lesson_subtitles_lesson_id ON lesson_subtitles(lesson_id);

-- Durable queue cho các tác vụ phát sinh từ media. Chỉ lưu metadata nhỏ;
-- video/audio vẫn nằm trong object storage và transcript vẫn ở lesson_subtitles.
CREATE TABLE IF NOT EXISTS background_jobs (
  job_id BIGSERIAL PRIMARY KEY,
  job_type VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(300) NOT NULL,
  lesson_id INT REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'completed', 'failed', 'cancelled')),
  priority SMALLINT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_owner VARCHAR(160),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  last_error_code VARCHAR(100),
  last_error_message VARCHAR(1000),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_background_jobs_type_key UNIQUE (job_type, dedupe_key),
  CONSTRAINT chk_background_jobs_payload_size CHECK (octet_length(payload::text) <= 65536)
);
CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON background_jobs(status, available_at, priority DESC, job_id)
  WHERE status IN ('queued', 'retry', 'processing');
CREATE INDEX IF NOT EXISTS idx_background_jobs_lesson ON background_jobs(lesson_id, job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_retention
  ON background_jobs(status, completed_at, updated_at)
  WHERE status IN ('completed', 'failed', 'cancelled');

CREATE OR REPLACE FUNCTION sync_subtitle_background_jobs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_source TEXT;
  v_payload JSONB;
BEGIN
  v_source := NULLIF(NEW.source_content_url, '');
  IF NEW.subtitle_status = 'pending' AND v_source IS NOT NULL THEN
    v_payload := jsonb_build_object('lessonId', NEW.lesson_id, 'sourceContentUrl', v_source);
    INSERT INTO background_jobs (job_type, dedupe_key, lesson_id, payload, status, priority, attempts, max_attempts, available_at, updated_at)
    VALUES ('subtitle_generation', 'lesson:' || NEW.lesson_id, NEW.lesson_id, v_payload, 'queued', 100, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (job_type, dedupe_key) DO UPDATE SET
      lesson_id = EXCLUDED.lesson_id, payload = EXCLUDED.payload,
      status = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry') THEN background_jobs.status
                    WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP THEN background_jobs.status
                    ELSE 'queued' END,
      attempts = CASE WHEN background_jobs.payload = EXCLUDED.payload AND (background_jobs.status IN ('queued', 'retry') OR (background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP)) THEN background_jobs.attempts ELSE 0 END,
      available_at = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry') THEN background_jobs.available_at
                          WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP THEN background_jobs.available_at ELSE CURRENT_TIMESTAMP END,
      lease_owner = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP THEN background_jobs.lease_owner ELSE NULL END,
      lease_token = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP THEN background_jobs.lease_token ELSE NULL END,
      lease_expires_at = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP THEN background_jobs.lease_expires_at ELSE NULL END,
      last_error_code = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry', 'processing') THEN background_jobs.last_error_code ELSE NULL END,
      last_error_message = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry', 'processing') THEN background_jobs.last_error_message ELSE NULL END,
      completed_at = NULL, updated_at = CURRENT_TIMESTAMP;
  END IF;

  IF NEW.subtitle_status = 'ready' AND v_source IS NOT NULL
     AND jsonb_typeof(COALESCE(NEW.cues, '[]'::jsonb)) = 'array'
     AND jsonb_array_length(COALESCE(NEW.cues, '[]'::jsonb)) > 0 THEN
    v_payload := jsonb_build_object('lessonId', NEW.lesson_id, 'sourceContentUrl', v_source, 'transcriptUpdatedAt', NEW.updated_at);
    INSERT INTO background_jobs (job_type, dedupe_key, lesson_id, payload, status, priority, attempts, max_attempts, available_at, updated_at)
    VALUES
      ('rag_ingestion', 'lesson:' || NEW.lesson_id, NEW.lesson_id, v_payload, 'queued', 50, 0, 6, CURRENT_TIMESTAMP + INTERVAL '2 minutes', CURRENT_TIMESTAMP),
      ('suggested_questions', 'lesson:' || NEW.lesson_id, NEW.lesson_id, v_payload, 'queued', 40, 0, 5, CURRENT_TIMESTAMP + INTERVAL '2 minutes', CURRENT_TIMESTAMP)
    ON CONFLICT (job_type, dedupe_key) DO UPDATE SET
      lesson_id = EXCLUDED.lesson_id, payload = EXCLUDED.payload,
      status = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry', 'processing', 'completed') THEN background_jobs.status ELSE 'queued' END,
      attempts = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry', 'processing', 'completed') THEN background_jobs.attempts ELSE 0 END,
      available_at = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status IN ('queued', 'retry', 'processing', 'completed') THEN background_jobs.available_at ELSE CURRENT_TIMESTAMP END,
      lease_owner = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' THEN background_jobs.lease_owner ELSE NULL END,
      lease_token = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' THEN background_jobs.lease_token ELSE NULL END,
      lease_expires_at = CASE WHEN background_jobs.payload = EXCLUDED.payload AND background_jobs.status = 'processing' THEN background_jobs.lease_expires_at ELSE NULL END,
      last_error_code = CASE WHEN background_jobs.payload = EXCLUDED.payload THEN background_jobs.last_error_code ELSE NULL END,
      last_error_message = CASE WHEN background_jobs.payload = EXCLUDED.payload THEN background_jobs.last_error_message ELSE NULL END,
      completed_at = CASE WHEN background_jobs.payload = EXCLUDED.payload THEN background_jobs.completed_at ELSE NULL END,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_lesson_subtitles_publish_jobs ON lesson_subtitles;
CREATE TRIGGER trg_lesson_subtitles_publish_jobs
AFTER INSERT OR UPDATE OF subtitle_status, source_content_url, cues, updated_at ON lesson_subtitles
FOR EACH ROW EXECUTE FUNCTION sync_subtitle_background_jobs();

-- 18. Tạo bảng Tài liệu đính kèm bài học (lesson_materials)
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
  CONSTRAINT chk_lesson_materials_media_status CHECK (media_status IS NULL OR media_status IN ('READY', 'UPLOADING', 'PROCESSING', 'MISSING_SOURCE', 'FAILED', 'PENDING_AUDIT'))
);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id ON lesson_materials(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_storage_key ON lesson_materials(storage_key);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_media_status ON lesson_materials(media_status);

-- 19. Tạo bảng Ghi chú & Highlight PDF Cá nhân (pdf_notes) - TASK-PDF-SMART-NOTES-01 & 02
CREATE TABLE IF NOT EXISTS pdf_notes (
  note_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  material_id INTEGER NULL REFERENCES lesson_materials(material_id) ON DELETE CASCADE,
  document_ref VARCHAR(255) NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  selection_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (selection_type IN ('text', 'area')),
  selected_text TEXT NULL,
  note_text TEXT NOT NULL DEFAULT '',
  category VARCHAR(30) NOT NULL CHECK (category IN ('important', 'not_understood', 'review', 'vocabulary')),
  color VARCHAR(20) NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'pink')),
  rects JSONB NOT NULL,
  context_before TEXT DEFAULT '',
  context_after TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pdf_notes_user_lesson_doc ON pdf_notes(user_id, lesson_id, document_ref);
CREATE INDEX IF NOT EXISTS idx_pdf_notes_user_lesson_page ON pdf_notes(user_id, lesson_id, page_number);

-- 20. Bảng Quản lý Upload Tạm thời & TTL Cleanup (pending_media_uploads) - TASK-DURABLE-MEDIA-R2.1
CREATE TABLE IF NOT EXISTS pending_media_uploads (
  upload_id UUID PRIMARY KEY,
  instructor_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id INT REFERENCES courses(course_id) ON DELETE SET NULL,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 'r2',
  storage_bucket VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PROCESSING', 'PENDING', 'CLAIMING', 'CLEANING', 'COMMITTED', 'FAILED', 'EXPIRED')),
  processing_stage VARCHAR(50),
  processing_error_code VARCHAR(100),
  processing_error_message VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  claimed_at TIMESTAMP WITH TIME ZONE
  ,cleaning_started_at TIMESTAMP WITH TIME ZONE
  ,media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL
  ,updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_status_expires ON pending_media_uploads(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_instructor ON pending_media_uploads(instructor_id);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_course ON pending_media_uploads(course_id);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_key ON pending_media_uploads(storage_key);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_processing ON pending_media_uploads(status, updated_at) WHERE status IN ('PROCESSING', 'FAILED');

-- 21. Bảng Hàng đợi Thử lại Xóa Storage Thất bại (failed_storage_deletions) - TASK-DURABLE-MEDIA-R2.1
CREATE TABLE IF NOT EXISTS failed_storage_deletions (
  deletion_id SERIAL PRIMARY KEY,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 'r2',
  storage_bucket VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_RETRY' CHECK (status IN ('PENDING_RETRY', 'FAILED_PERMANENT', 'RESOLVED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
  ,pending_upload_id UUID REFERENCES pending_media_uploads(upload_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_failed_storage_deletions_retry ON failed_storage_deletions(status, next_retry_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_failed_storage_deletions_object ON failed_storage_deletions(storage_provider, storage_bucket, storage_key);
CREATE INDEX IF NOT EXISTS idx_lessons_media_asset_id ON lessons(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_media_asset_id ON lesson_materials(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_media_id ON pending_media_uploads(media_id);

-- Missing indexes for common queries
CREATE INDEX IF NOT EXISTS idx_courses_subject_status_instructor ON courses(subject_id, status, instructor_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_lesson_completed ON user_progress(user_id, is_completed, lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_discussions_unread ON course_discussions(student_id, course_id, student_unread) WHERE student_unread = true;
CREATE INDEX IF NOT EXISTS idx_course_discussions_instructor_queue ON course_discussions(course_id, status, instructor_unread, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_date ON ai_usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_model_status_date ON ai_usage_events(model, request_status, created_at);
CREATE INDEX IF NOT EXISTS idx_sections_course_order ON sections(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_section_order ON lessons(section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_date ON quiz_attempts(user_id, completed_at);

CREATE OR REPLACE FUNCTION infer_media_kind(p_mime TEXT, p_key TEXT)
RETURNS VARCHAR(20) LANGUAGE SQL IMMUTABLE AS $$
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
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_media_id UUID; v_provider TEXT; v_bucket TEXT; v_key TEXT; v_mime TEXT;
  v_size BIGINT; v_checksum TEXT; v_status TEXT; v_filename TEXT; v_created_by INT;
BEGIN
  IF TG_TABLE_NAME = 'lessons' THEN
    v_provider := CASE WHEN NEW.storage_provider = 'local' THEN 'legacy_local' ELSE COALESCE(NEW.storage_provider, CASE WHEN NEW.content_url LIKE '/uploads/%' THEN 'legacy_local' END) END;
    v_bucket := NEW.storage_bucket; v_key := COALESCE(NEW.storage_key, NULLIF(NEW.content_url, ''));
    v_mime := COALESCE(NEW.mime_type, CASE WHEN NEW.content_type = 'pdf' THEN 'application/pdf' WHEN NEW.content_type = 'video' THEN 'video/mp4' END);
    v_size := COALESCE(NEW.size_bytes, 0); v_checksum := NEW.checksum_sha256;
    v_status := COALESCE(NEW.media_status, 'PENDING_AUDIT'); v_filename := NEW.title;
  ELSIF TG_TABLE_NAME = 'lesson_materials' THEN
    v_provider := CASE WHEN NEW.storage_provider = 'local' THEN 'legacy_local' ELSE COALESCE(NEW.storage_provider, CASE WHEN NEW.file_url LIKE '/uploads/%' THEN 'legacy_local' END) END;
    v_bucket := NEW.storage_bucket; v_key := COALESCE(NEW.storage_key, NULLIF(NEW.file_url, ''));
    v_mime := COALESCE(NEW.mime_type, NEW.file_type, 'application/pdf');
    v_size := COALESCE(NEW.size_bytes, COALESCE(NEW.file_size_kb, 0)::BIGINT * 1024);
    v_checksum := NEW.checksum_sha256; v_status := COALESCE(NEW.media_status, 'PENDING_AUDIT');
    v_filename := NEW.file_name; v_created_by := NEW.uploaded_by;
  ELSE RETURN NEW;
  END IF;
  IF v_key IS NULL OR v_provider IS NULL OR v_mime IS NULL THEN NEW.media_asset_id := NULL; RETURN NEW; END IF;
  SELECT media_id INTO v_media_id FROM media_assets
    WHERE storage_provider = v_provider AND storage_bucket IS NOT DISTINCT FROM v_bucket
      AND object_key = v_key AND deleted_at IS NULL LIMIT 1;
  IF v_media_id IS NULL THEN
    INSERT INTO media_assets (media_kind, storage_provider, storage_bucket, object_key, original_filename, mime_type, size_bytes, checksum_sha256, status, created_by)
    VALUES (infer_media_kind(v_mime, v_key), v_provider, v_bucket, v_key, v_filename, v_mime, v_size, v_checksum, v_status, v_created_by)
    RETURNING media_id INTO v_media_id;
  ELSE
    UPDATE media_assets SET mime_type = v_mime, size_bytes = GREATEST(size_bytes, v_size), checksum_sha256 = COALESCE(v_checksum, checksum_sha256),
      status = v_status, original_filename = COALESCE(original_filename, v_filename), updated_at = CURRENT_TIMESTAMP WHERE media_id = v_media_id;
  END IF;
  NEW.media_asset_id := v_media_id; RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lessons_sync_media_asset ON lessons;
CREATE TRIGGER trg_lessons_sync_media_asset BEFORE INSERT OR UPDATE OF content_url, storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
ON lessons FOR EACH ROW EXECUTE FUNCTION sync_media_asset_reference();
DROP TRIGGER IF EXISTS trg_lesson_materials_sync_media_asset ON lesson_materials;
CREATE TRIGGER trg_lesson_materials_sync_media_asset BEFORE INSERT OR UPDATE OF file_url, storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
ON lesson_materials FOR EACH ROW EXECUTE FUNCTION sync_media_asset_reference();

