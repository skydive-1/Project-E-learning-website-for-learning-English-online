-- =============================================================================
-- Migration: Bật Row-Level Security (RLS) cho PostgreSQL / Supabase
-- Mục tiêu: Bảo vệ các bảng dữ liệu cốt lõi, ngăn chặn truy vấn trực tiếp
--          từ các client lạ sử dụng Supabase Anon Key qua PostgREST API.
-- Lưu ý: Backend Express sử dụng trực tiếp tài khoản Postgres Superuser/Owner
--        (quyền BYPASSRLS) nên mọi hoạt động hệ thống nội bộ vẫn đảm bảo 100%.
-- =============================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'users',
        'ai_question_quotas',
        'lesson_pdf_notes',
        'course_discussions',
        'consultation_requests',
        'user_progress',
        'quiz_answers',
        'quizzes',
        'courses',
        'lessons',
        'enrollments',
        'comments'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Kiểm tra bảng có tồn tại trước khi bật RLS (tránh lỗi nếu môi trường test thiếu bảng)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;
