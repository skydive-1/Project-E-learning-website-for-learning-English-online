-- =====================================================================
-- Migration: Upgrade users.profile_picture_url from VARCHAR(255) to TEXT
-- Cho phép lưu trữ URL ảnh đại diện dài (Supabase Storage, CDN, Google Photos token, Base64)
-- =====================================================================

ALTER TABLE users 
  ALTER COLUMN profile_picture_url TYPE TEXT;
