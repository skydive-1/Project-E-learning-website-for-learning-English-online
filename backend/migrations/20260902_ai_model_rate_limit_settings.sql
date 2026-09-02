-- Hạn mức Gemini do quản trị viên xác nhận từ Google AI Studio.
-- Không seed giá trị mặc định: cap chỉ có hiệu lực sau khi admin chủ động lưu.

CREATE TABLE IF NOT EXISTS ai_model_rate_limit_settings (
  model TEXT PRIMARY KEY,
  rpm_cap INTEGER NOT NULL CHECK (rpm_cap > 0),
  tpm_cap INTEGER NOT NULL CHECK (tpm_cap > 0),
  rpd_cap INTEGER NOT NULL CHECK (rpd_cap > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INT REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_model_date
  ON ai_usage_events(model, created_at);

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
