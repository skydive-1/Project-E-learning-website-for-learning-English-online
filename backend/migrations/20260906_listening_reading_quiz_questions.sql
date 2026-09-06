-- Migration: Thêm 2 loại câu hỏi mới ('listening', 'reading') vào hệ thống Quiz
-- Bổ sung audio_url (cho listening) và passage_text (cho reading) vào bảng questions.
-- Tác giả: LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)

BEGIN;

-- 1. Bổ sung các cột lưu trữ tài nguyên đa phương tiện và đoạn văn đọc hiểu
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage_text TEXT;

-- 2. Cập nhật CHECK constraint kiểm tra loại câu hỏi (question_type)
-- Xóa an toàn cả hai tên constraint khả dĩ để đảm bảo tính idempotent
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_question_type;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;

-- Thiết lập constraint mới cho phép đầy đủ 6 loại câu hỏi
ALTER TABLE questions ADD CONSTRAINT chk_question_type 
  CHECK (
    question_type IS NULL OR 
    question_type IN (
      'multiple_choice', 
      'writing', 
      'pronunciation', 
      'open_cloze', 
      'listening', 
      'reading'
    )
  );

COMMIT;
