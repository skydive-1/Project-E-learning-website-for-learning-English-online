-- Thêm các trường hỗ trợ Admin tự khóa/mở khóa model AI thủ công
ALTER TABLE ai_model_rate_limit_settings
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- Xóa bỏ các giá trị rpd_exhausted_until cũ để tránh việc khóa nhầm tồn đọng
UPDATE ai_model_rate_limit_settings
SET rpd_exhausted_until = NULL
WHERE rpd_exhausted_until IS NOT NULL;
