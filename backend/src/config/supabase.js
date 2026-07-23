const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Sử dụng key dự phòng (fallback) để giữ tương thích với cấu hình cũ của Liêm
const fallbackKey = supabaseServiceRoleKey || process.env.SUPABASE_KEY || supabaseAnonKey;

if (!supabaseUrl) {
  console.warn('⚠️ Cảnh báo: SUPABASE_URL chưa được cấu hình trong file .env');
}

// 1. Client mặc định
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  fallbackKey || 'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// 2. Client Admin (Bỏ qua RLS, phục vụ tạo/xóa tài khoản từ Server)
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
  : supabase; // Dự phòng về client mặc định nếu thiếu key

// 3. Client Anon (Dùng Anon Key cho các tác vụ công khai của user)
const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
  : supabase; // Dự phòng về client mặc định nếu thiếu key

// Đính kèm các named exports làm thuộc tính của client chính
// (Để hỗ trợ cả cú pháp: const { supabaseAdmin, supabaseClient } = require('./supabase'))
supabase.supabase = supabase;
supabase.supabaseAdmin = supabaseAdmin;
supabase.supabaseClient = supabaseClient;

// Xuất ra đối tượng client chính để tương thích cú pháp: const supabase = require('./supabase') của Liêm
module.exports = supabase;
