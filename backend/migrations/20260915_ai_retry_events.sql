-- Telemetry nội bộ cho các lần Gemini được backend lên lịch retry.
-- Không phải số liệu Usage do Google AI Studio cung cấp.

CREATE TABLE IF NOT EXISTS ai_retry_events (
  retry_event_id BIGSERIAL PRIMARY KEY,
  usage_event_id INT REFERENCES ai_usage_events(id) ON DELETE SET NULL,
  user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
  purpose VARCHAR(120) NOT NULL,
  operation VARCHAR(32) NOT NULL,
  model VARCHAR(160) NOT NULL,
  retry_attempt SMALLINT NOT NULL CHECK (retry_attempt > 0),
  max_retries SMALLINT NOT NULL CHECK (max_retries >= 0),
  delay_ms INTEGER NOT NULL CHECK (delay_ms >= 0),
  delay_source VARCHAR(40) NOT NULL,
  retry_reason VARCHAR(80) NOT NULL,
  error_code VARCHAR(100) NOT NULL,
  http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_retry_events_model_date
  ON ai_retry_events(model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_retry_events_date
  ON ai_retry_events(created_at DESC);
