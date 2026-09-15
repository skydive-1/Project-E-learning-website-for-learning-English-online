BEGIN;

-- schema.sql và các service chatbot dùng ai_chat làm khóa chính. Một số database
-- được khởi tạo từ migration 001 cũ có thể vẫn mang tên chat_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_chat'
      AND column_name = 'chat_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_chat'
      AND column_name = 'ai_chat'
  ) THEN
    ALTER TABLE ai_chat RENAME COLUMN chat_id TO ai_chat;
  END IF;
END
$$;

COMMIT;
