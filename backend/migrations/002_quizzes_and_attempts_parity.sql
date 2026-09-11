-- Migration 002: Quizzes and Attempts Schema Parity & Integrity
-- Author: LÊ ĐÌNH CHƯƠNG (Database Administrator) & NGUYỄN THANH LIÊM (Backend Developer)
-- Module: Assessment & Data Integrity

-- 1. Đảm bảo bảng quizzes có đầy đủ các cột nghiệp vụ
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20) DEFAULT NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'Medium';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INT DEFAULT 10;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. Đảm bảo bảng quiz_attempts có nickname và quy định rõ ràng tính toàn vẹn
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- user_id cho phép NULL (để hỗ trợ học viên tự do làm quiz vãng lai với nickname)
ALTER TABLE quiz_attempts ALTER COLUMN user_id DROP NOT NULL;

-- quiz_id BẮT BUỘC NOT NULL (một lượt làm bài bắt buộc phải thuộc về một đề quiz cụ thể)
DELETE FROM quiz_attempts WHERE quiz_id IS NULL;
ALTER TABLE quiz_attempts ALTER COLUMN quiz_id SET NOT NULL;

-- 3. Đảm bảo các chỉ mục (indexes) phục vụ truy vấn tối ưu
CREATE INDEX IF NOT EXISTS idx_quizzes_is_private ON quizzes(is_private);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_score ON quiz_attempts(quiz_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_date ON quiz_attempts(user_id, completed_at);
