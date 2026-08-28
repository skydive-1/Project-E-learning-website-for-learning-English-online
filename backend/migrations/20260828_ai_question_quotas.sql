-- Quota câu hỏi AI theo cửa sổ rolling 24 giờ.
-- Student: 10 câu; Instructor: 20 câu; Admin/Super Admin bỏ qua ở middleware.

CREATE TABLE IF NOT EXISTS ai_question_quotas (
  user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  used_questions INT NOT NULL DEFAULT 0 CHECK (used_questions >= 0),
  window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_question_quotas_window
  ON ai_question_quotas(window_started_at);
