-- Email verification for password-based registrations.
-- Existing accounts are preserved as verified because the old registration
-- flow marked every Supabase user as confirmed at creation time.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_date, CURRENT_TIMESTAMP)
WHERE email_verified_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_verification_token_hash
  ON users(email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
