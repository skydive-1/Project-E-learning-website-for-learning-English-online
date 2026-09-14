-- Migration: Add OTP columns for Two-Factor Password Change Verification
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_change_otp_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS password_change_otp_expires_at TIMESTAMPTZ;
