-- =========================================================================
-- DATABASE SCHEMA: E-LEARNING WEBSITE FOR LEARNING ENGLISH ONLINE
-- =========================================================================

-- 1. Tạo bảng Roles (Vai trò người dùng)
CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE, -- 'admin', 'instructor', 'student'
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tạo bảng Users (Người dùng)
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tạo bảng Subjects (Môn học)
CREATE TABLE IF NOT EXISTS subjects (
  subject_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tạo bảng Courses (Khóa học)
CREATE TABLE IF NOT EXISTS courses (
  course_id SERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(subject_id) ON DELETE RESTRICT,
  instructor_id INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  course_name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  level VARCHAR(50), -- 'Beginner', 'Intermediate', 'Advanced'
  status VARCHAR(20) NOT NULL DEFAULT 'published', -- 'draft', 'published', 'archived'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tạo bảng Sections (Chương học)
CREATE TABLE IF NOT EXISTS sections (
  section_id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tạo bảng Lessons (Bài học)
CREATE TABLE IF NOT EXISTS lessons (
  lesson_id SERIAL PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(20) NOT NULL, -- video, pdf, quiz, text
  content_url TEXT,
  order_index INT NOT NULL,
  pdf_version INT NOT NULL DEFAULT 1 CHECK (pdf_version >= 1),
  CONSTRAINT fk_lesson_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE
);

-- 7. Tạo bảng User Progress (Tiến độ học tập)
CREATE TABLE IF NOT EXISTS user_progress (
  progress_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  UNIQUE(user_id, lesson_id)
);

-- 8. Tạo bảng Enrollments (Đăng ký khóa học)
CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'dropped'
  UNIQUE(user_id, course_id)
);

-- 9. Tạo bảng Quizzes (Bài tập trắc nghiệm)
CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  passing_score INT NOT NULL DEFAULT 70,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tạo bảng Quiz Questions (Câu hỏi trắc nghiệm)
CREATE TABLE IF NOT EXISTS quiz_questions (
  question_id SERIAL PRIMARY KEY,
  quiz_id INT NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  explanation TEXT,
  order_index INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Tạo bảng Quiz Answers (Đáp án câu hỏi)
CREATE TABLE IF NOT EXISTS quiz_answers (
  answer_id SERIAL PRIMARY KEY,
  question_id INT NOT NULL REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tạo bảng Quiz Submissions (Lịch sử làm bài)
CREATE TABLE IF NOT EXISTS quiz_submissions (
  submission_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  quiz_id INT NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  score INT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tạo bảng Orders (Đơn hàng)
CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tạo bảng Order Details (Chi tiết đơn hàng)
CREATE TABLE IF NOT EXISTS order_details (
  order_detail_id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Tạo bảng Reviews (Đánh giá khóa học)
CREATE TABLE IF NOT EXISTS reviews (
  review_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

-- 16. Tạo bảng Study Sessions (Theo dõi thời gian học thực tế)
CREATE TABLE IF NOT EXISTS study_sessions (
  session_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_lesson_date UNIQUE (user_id, lesson_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_lesson ON study_sessions(lesson_id);

-- 17. Tạo bảng AI Conversations (Lưu lịch sử hội thoại Chatbot AI)
CREATE TABLE IF NOT EXISTS ai_conversations (
  conversation_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lesson_id INTEGER NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'evaluation')),
  content TEXT NOT NULL,
  audio_url TEXT NULL,
  audio_duration_seconds REAL NULL,
  evaluation_score JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_lesson ON ai_conversations(user_id, lesson_id, created_at);

-- 18. Tạo bảng Lesson Materials (Tài liệu đính kèm bài học)
CREATE TABLE IF NOT EXISTS lesson_materials (
  material_id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) DEFAULT 'application/pdf',
  file_size_kb INT DEFAULT 0,
  pdf_version INT NOT NULL DEFAULT 1 CHECK (pdf_version >= 1),
  uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id ON lesson_materials(lesson_id);

-- 19. Tạo bảng Ghi chú & Highlight PDF Cá nhân (pdf_notes) - TASK-PDF-SMART-NOTES-01, 02 & 03
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
