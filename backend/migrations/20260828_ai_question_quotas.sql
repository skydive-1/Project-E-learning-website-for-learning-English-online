-- Quota câu hỏi AI — reset cố định lúc 00:00 giờ Việt Nam (UTC+7) mỗi ngày.
-- Student: 10 câu/ngày; Instructor: 20 câu/ngày; Admin/Super Admin bỏ qua ở middleware.
-- Cột window_started_at ghi thời điểm bắt đầu chu kỳ hiện tại; logic so sánh
-- ngày lịch VN nằm ở application layer (AT TIME ZONE 'Asia/Ho_Chi_Minh').

CREATE TABLE IF NOT EXISTS ai_question_quotas (
  user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  used_questions INT NOT NULL DEFAULT 0 CHECK (used_questions >= 0),
  window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_question_quotas_window
  ON ai_question_quotas(window_started_at);
