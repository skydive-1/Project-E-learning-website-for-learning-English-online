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
  instructor_id INT NOT NULL,
  thumbnail_url VARCHAR(255),
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
  CONSTRAINT fk_lesson_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE
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
  time_limit INT DEFAULT 10, -- Số phút làm bài
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiz_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE
);

-- 9. Tạo bảng Questions (Câu hỏi trắc nghiệm liên kết với quizzes)
CREATE TABLE IF NOT EXISTS questions (
  question_id SERIAL PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL, -- A, B, C, D hoặc câu phát âm / đáp án mẫu
  explanation TEXT,
  question_type VARCHAR(50) DEFAULT 'multiple_choice',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- 10. Tạo bảng Quiz Attempts (Lịch sử làm bài trắc nghiệm)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  attempt_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  quiz_id INT NOT NULL,
  score INT NOT NULL, -- Điểm số (0 - 100)
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
  is_auto_generated_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lesson_subtitles_lesson_id ON lesson_subtitles(lesson_id);

-- 18. Tạo bảng Tài liệu đính kèm bài học (lesson_materials)
CREATE TABLE IF NOT EXISTS lesson_materials (
  material_id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) DEFAULT 'application/pdf',
  file_size_kb INT DEFAULT 0,
  pdf_version INT DEFAULT 1,
  uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id ON lesson_materials(lesson_id);

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
