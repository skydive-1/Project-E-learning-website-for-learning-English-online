-- Bảng ghi nhận mức sử dụng thực tế từ Gemini API cho từng cuộc gọi.
-- Mỗi row = 1 lần gọi API thành công, ghi lại token thực tế từ usageMetadata.
-- Dùng cho dashboard admin hiển thị chi phí / token thật thay vì ước lượng cứng.

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
