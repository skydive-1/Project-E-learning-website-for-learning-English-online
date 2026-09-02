-- Dữ liệu lịch sử tổng hợp lấy trực tiếp từ Google AI Studio > Usage.
-- Project nguồn: E-Learn Project (projects/240392977153).
-- Không chứa user_id/purpose vì Google chỉ cung cấp số liệu theo project/model/ngày.
-- Project "API KEY PJ" có key từng bị lộ KHÔNG được đưa vào migration này.

CREATE TABLE IF NOT EXISTS ai_usage_daily_model_history (
  usage_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_ai_studio',
  source_project TEXT NOT NULL,
  source_project_ref TEXT NOT NULL,
  model TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens BIGINT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, source_project_ref, usage_date, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_model_history_date
  ON ai_usage_daily_model_history(usage_date);

CREATE TABLE IF NOT EXISTS ai_usage_daily_project_history (
  usage_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_ai_studio',
  source_project TEXT NOT NULL,
  source_project_ref TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0 CHECK (total_requests >= 0),
  successful_requests INTEGER NOT NULL DEFAULT 0 CHECK (successful_requests >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  success_rate NUMERIC(10, 9) CHECK (success_rate >= 0 AND success_rate <= 1),
  errors_by_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, source_project_ref, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_project_history_date
  ON ai_usage_daily_project_history(usage_date);

INSERT INTO ai_usage_daily_model_history
  (usage_date, source, source_project, source_project_ref, model, request_count, input_tokens, output_tokens, is_trusted)
VALUES
  ('2026-08-17', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.1-flash-lite', 25, 9989, 4367, TRUE),
  ('2026-08-22', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.1-flash-lite', 9, 5204, 932, TRUE),
  ('2026-08-26', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.1-flash-lite', 2, 548, 144, TRUE),
  ('2026-08-27', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.1-flash-lite', 1, 3404, 408, TRUE),

  ('2026-08-15', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash', 1, 1, 0, TRUE),
  ('2026-08-16', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash', 3, 7658, 11681, TRUE),
  ('2026-08-17', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash', 8, 2665, 7872, TRUE),
  ('2026-08-29', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash', 1, 6, 71, TRUE),

  ('2026-08-17', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 335, 133642, 66454, TRUE),
  ('2026-08-18', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 90, 55792, 25281, TRUE),
  ('2026-08-19', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 6, 3752, 2404, TRUE),
  ('2026-08-20', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 11, 5295, 2052, TRUE),
  ('2026-08-21', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 36, 131422, 122521, TRUE),
  ('2026-08-22', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 38, 31591, 5986, TRUE),
  ('2026-08-23', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 2, 4345, 525, TRUE),
  ('2026-08-24', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 1, 201, 693, TRUE),
  ('2026-08-25', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 1, 3985, 409, TRUE),
  ('2026-08-26', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 31, 40406, 44425, TRUE),
  ('2026-08-27', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.5-flash-lite', 10, 9007, 1858, TRUE),

  ('2026-08-29', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.6-flash', 22, 29478, 33755, TRUE),

  ('2026-08-15', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.7-flash', 9, 718, 1925, TRUE),
  ('2026-08-16', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.7-flash', 5, 2294, 998, TRUE),
  ('2026-08-17', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.7-flash', 22, 5915, 4722, TRUE),
  ('2026-08-29', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-3.7-flash', 15, 2337, 1004, TRUE),

  ('2026-08-15', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 6, 31, 0, TRUE),
  ('2026-08-16', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 61, 8780, 0, TRUE),
  ('2026-08-17', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 1029, 61114, 0, TRUE),
  ('2026-08-18', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 13, 125, 0, TRUE),
  ('2026-08-19', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 3, 50, 0, TRUE),
  ('2026-08-20', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 4, 60, 0, TRUE),
  ('2026-08-21', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 70, 8821, 0, TRUE),
  ('2026-08-22', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 1, 27, 0, TRUE),
  ('2026-08-26', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 26, 4678, 0, TRUE),
  ('2026-08-29', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-001', 14, 2453, 0, TRUE),

  ('2026-08-15', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 'gemini-embedding-2', 1, 3, 0, TRUE)
ON CONFLICT (source, source_project_ref, usage_date, model) DO UPDATE SET
  source_project = EXCLUDED.source_project,
  request_count = EXCLUDED.request_count,
  input_tokens = EXCLUDED.input_tokens,
  output_tokens = EXCLUDED.output_tokens,
  is_trusted = EXCLUDED.is_trusted,
  imported_at = NOW();

INSERT INTO ai_usage_daily_project_history
  (usage_date, source, source_project, source_project_ref, total_requests, successful_requests, error_count, success_rate, errors_by_status, is_trusted)
VALUES
  ('2026-08-15', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 27, 15, 12, 0.555555556, '{"404": 8, "503": 4}', TRUE),
  ('2026-08-16', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 69, 66, 3, 0.956521739, '{"503": 3}', TRUE),
  ('2026-08-17', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 1581, 1415, 166, 0.895003163, '{"404": 81, "429": 77, "503": 8}', TRUE),
  ('2026-08-18', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 105, 100, 5, 0.952380952, '{"404": 5}', TRUE),
  ('2026-08-19', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 9, 9, 0, 1, '{}', TRUE),
  ('2026-08-20', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 15, 15, 0, 1, '{}', TRUE),
  ('2026-08-21', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 106, 106, 0, 1, '{}', TRUE),
  ('2026-08-22', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 56, 47, 9, 0.839285714, '{"429": 9}', TRUE),
  ('2026-08-23', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 2, 2, 0, 1, '{}', TRUE),
  ('2026-08-24', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 1, 1, 0, 1, '{}', TRUE),
  ('2026-08-25', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 1, 1, 0, 1, '{}', TRUE),
  ('2026-08-26', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 59, 56, 3, 0.949152542, '{"503": 3}', TRUE),
  ('2026-08-27', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 11, 10, 1, 0.909090909, '{"503": 1}', TRUE),
  ('2026-08-29', 'google_ai_studio', 'E-Learn Project', 'projects/240392977153', 350, 43, 307, 0.122857143, '{"404": 145, "429": 150, "499": 2, "503": 10}', TRUE)
ON CONFLICT (source, source_project_ref, usage_date) DO UPDATE SET
  source_project = EXCLUDED.source_project,
  total_requests = EXCLUDED.total_requests,
  successful_requests = EXCLUDED.successful_requests,
  error_count = EXCLUDED.error_count,
  success_rate = EXCLUDED.success_rate,
  errors_by_status = EXCLUDED.errors_by_status,
  is_trusted = EXCLUDED.is_trusted,
  imported_at = NOW();
