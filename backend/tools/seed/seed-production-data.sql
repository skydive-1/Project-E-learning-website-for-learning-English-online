-- =====================================================================
-- DỮ LIỆU ĐỒNG BỘ TỪ PRODUCTION (SUPABASE) CHO DOCKER LOCAL TESTING
-- Tạo lúc: 2026-08-20T13:31:38.788Z
-- =====================================================================

-- Dữ liệu bảng roles (3 records)
INSERT INTO "roles" ("role_id", "role_name")
VALUES
  (1, 'Admin'),
  (2, 'Instructor'),
  (3, 'Student')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"roles"', 'role_id'), coalesce(max("role_id"), 1), max("role_id") IS NOT NULL) FROM "roles";

-- Dữ liệu bảng users (23 records)
INSERT INTO "users" ("user_id", "username", "password_hash", "created_date", "full_name", "birth_date", "email", "phone", "role_id", "gender", "profile_picture_url", "supabase_uid", "longest_streak", "created_at", "updated_at")
VALUES
  (3, 'testuser', '$2b$10$I2gN7v8PGmXWxGjFO345FukEaze6mD5FwB2Ssb9Pxj..quP.RAIgq', '2026-06-11T21:13:00.931Z', 'testuser', NULL, 'test1781237581210@gmail.com', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (4, 'sky3337 ', '$2b$10$WhWOXnwylMkv/ZgsPKUnOeeN4jHB57Ma.a1z3I/OEK.D/hJZ4dtNC', '2026-06-11T21:19:11.440Z', 'sky3337 ', NULL, 'quocanh26012004@gmail.com', NULL, 1, NULL, NULL, '2b63c470-ded8-4a56-a4de-cf8937b85ca1', 3, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (5, 'sky3332', '$2b$10$OxTVMhMRkoxLbOn5MXkeluuB.xMy3M3mzHH/tiucRa4PB5mQBg9Mu', '2026-06-14T19:14:19.541Z', 'sky3332', NULL, 'lek262623@gmail.com', NULL, 2, NULL, NULL, '004a00d8-c538-4666-b596-68d967768fb4', 2, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (6, 'teststudent', '$2b$10$AxZIONsaJHee13ZMnsl3Be1OCzYZ8XhaM4nO5lQ/zUCSUmvWnelri', '2026-06-14T19:21:56.149Z', 'teststudent', NULL, 'teststudent@example.com', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (7, 'newinstructor', '$2b$10$0V/KTw2ej9JuvULclfxcae/8qkrsqO1j/QWJUwVf3g9sj4g5H1Q3S', '2026-06-15T20:01:01.325Z', 'newinstructor', NULL, 'newinstructor@example.com', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (8, 'newinstructor2', '$2b$10$R1dwvvfXeJRHywEZbUetQ.6W4etK26HuvRbnxn.kZTuLuHF0msJ3e', '2026-06-15T20:03:22.849Z', 'newinstructor2', NULL, 'newinstructor2@example.com', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (9, 'newinstructor3', '$2b$10$C91EMTqmCkPbFwd7r9jFHua6NQo7Poa4Rmc7SygffQnNSF4mWWR4m', '2026-06-15T20:06:13.247Z', 'newinstructor3', NULL, 'newinstructor3@example.com', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (10, 'newstudent7', '$2b$10$QoiaQDkDmROn3Nju56.VEeYAx5B3JpyQ1R3fuCSlpdmVaexivIdzG', '2026-06-15T20:11:43.175Z', 'newstudent7', NULL, 'newstudent7@example.com', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (11, 'newinstructor4', '$2b$10$dqO96UoexkIAKqXrEsEvTeipFUTnAQI5XfOY8XVrJjjbrd298fAQG', '2026-06-15T20:14:08.808Z', 'newinstructor4', NULL, 'newinstructor4@example.com', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (13, 'testhocsinh', '$2b$10$hYCSGey91HnW7x20s8r0b.KRFabiYjGh12tOUT2O2N7PrS00vpRMi', '2026-06-19T20:04:23.275Z', 'testhocsinh', NULL, 'aduvip@gmail.com', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (14, 'hocvientest', '$2b$10$p2nmuPndklR53F3eJ1tFw.Rkkbf4JPhVqvOzkqyoTnzbHyHhOOlZ.', '2026-06-24T20:27:46.348Z', 'hocvientest', NULL, 'hocvientest123@gmail.com', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (15, 'test_instructor', '$2b$10$xhmfp0uxqTKgftOiBSqYke7XQBbTEm8oEvRfP1psX8UCWXSMOAs5C', '2026-06-28T19:56:55.726Z', 'test_instructor', NULL, 'test_inst_1@test.com', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (17, 'smonsmith5', '$2b$10$E05tvbkLJ27LDL9XGEF3cO2x0IbP2yocvYOOkXIzSYumbiz.CBvhO', '2026-07-01T21:03:48.847Z', 'Smith Smon', NULL, 'smonsmith5@gmail.com', NULL, 2, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocKBEXscpZAcFfnoRMKhs1_a2VF0G9RQrcyv-HWn3SChx16Urg=s96-c', '18408bea-54c5-41ce-93cc-12ec321d678c', 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (18, '2200002309', '$2b$10$E3it2Y.CC4U9r9YkrFf8m.HUIILPORhvcZx9ScrlkUIW526AiHVb.', '2026-07-08T20:11:23.514Z', 'Anh Nguyễn Dũng Quốc', NULL, '2200002309@nttu.edu.vn', NULL, 3, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocIwubQHXgQsccubpdbpMrNFfjuLsJzXzLgTrG3I_L3JWVo6Jg=s96-c', '06a6fca1-4d0a-4073-8c81-ac1922364968', 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (27, 'bte29092004', '', '2026-07-30T19:03:50.713Z', 'Liêm Nguyễn', NULL, 'bte29092004@gmail.com', NULL, 1, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocJma6b2yHlP76PTY_06hEQcDzNUwDtKQPw17sCEWeCTaBT7MHl5=s96-c', 'a359a8f7-50ce-49d1-838f-1d8525776b84', 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (30, 'dragonx29092004', '', '2026-08-05T05:26:00.101Z', 'Liêm Nguyễn', NULL, 'dragonx29092004@gmail.com', NULL, 3, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocI8WHa8Ia8GJUT_8Bd4AKvlM0EcmK4Ei2FP4zvlRoYyX53u4iF2=s96-c', '574f3fdc-1624-4845-b8ac-5cee4e4cd327', 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (31, 'Nguyenliem', '', '2026-08-12T19:47:37.382Z', 'Nguyenliem', NULL, 'bte2004@gmail.com', NULL, 2, NULL, NULL, '7e14cc9a-f4a2-485e-bd7c-b90dfbbde9b7', 1, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (32, 'ntai16386', '', '2026-08-13T19:17:48.919Z', 'Tài Nguyễn', NULL, 'ntai16386@gmail.com', NULL, 3, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocIoU0wEQCH3fD91B_vbdv5asQppa4SwASHCBPksmafo_MKgmw=s96-c', 'cab7a7ea-82ae-458b-a199-561c6e2a64c2', 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (34, 'instructor_demo', 'Instructor@123', '2026-08-17T22:41:45.313Z', 'Demo Instructor', NULL, 'instructor@elearn.edu.vn', NULL, 2, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (35, 'student_demo', 'Student@123', '2026-08-17T22:41:45.313Z', 'Demo Student', NULL, 'student@elearn.edu.vn', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (36, 'student_demo_2', 'Student@123', '2026-08-18T03:46:39.307Z', 'Hoang Nhat Nam', NULL, 'PretyDerby@elearn.edu.vn', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (38, 'student_demo_3', 'Student@123456', '2026-08-18T03:47:29.172Z', 'Nguyen Thanh Bing Chiling', NULL, 'DmThangLmao@elearn.edu.vn', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z'),
  (39, 'student_demo_4', 'Student@456', '2026-08-18T03:48:19.558Z', 'Not Phuc but Phuck', NULL, 'NoBlueKOK@elearn.edu.vn', NULL, 3, NULL, NULL, NULL, 0, '2026-08-20T01:18:37.022Z', '2026-08-20T01:18:37.022Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"users"', 'user_id'), coalesce(max("user_id"), 1), max("user_id") IS NOT NULL) FROM "users";

-- Dữ liệu bảng subjects (5 records)
INSERT INTO "subjects" ("subject_id", "subject_name", "credits")
VALUES
  (1, 'IELTS Masterclass', 4),
  (2, 'TOEIC Prep', 3),
  (3, 'Business English', 3),
  (4, 'General English Communication', 2),
  (5, 'English Grammar Essentials', 2)
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"subjects"', 'subject_id'), coalesce(max("subject_id"), 1), max("subject_id") IS NOT NULL) FROM "subjects";

-- Dữ liệu bảng courses (13 records)
INSERT INTO "courses" ("course_id", "subject_id", "course_name", "start_date", "end_date", "status", "description", "instructor_id", "thumbnail_url", "price", "created_at", "updated_at")
VALUES
  (1, 1, 'Luyện thi Tiếng Anh', '2026-06-17T17:00:00.000Z', '2027-06-17T17:00:00.000Z', 'published', NULL, NULL, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (5, 4, 'English for Communication & AI Interaction', '2026-06-19T17:00:00.000Z', '2027-06-19T17:00:00.000Z', 'published', 'Khóa học tiếng Anh giao tiếp phản xạ kết hợp Trợ lý học tập AI.', NULL, '/images/hero_illustration.png', '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (14, 1, 'Ôn tập căn bản ', '2026-06-22T17:00:00.000Z', '2026-08-24T17:00:00.000Z', 'published', NULL, 4, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (15, 1, 'Luyện nói (Speaking)', '2026-06-29T17:00:00.000Z', '2026-08-12T17:00:00.000Z', 'published', NULL, NULL, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (16, 1, 'Luyện speaking ', '2026-06-30T17:00:00.000Z', '2026-09-14T17:00:00.000Z', 'published', NULL, NULL, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (18, 1, 'Luyện Tiếng Anh Căn Bản', '2026-07-01T17:00:00.000Z', '2026-09-10T17:00:00.000Z', 'published', NULL, 5, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (19, 4, 'English Practicing', '2026-08-08T17:00:00.000Z', '2026-08-17T17:00:00.000Z', 'published', NULL, 5, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (20, 1, 'Luyện Speaking IELTS', '2026-08-10T17:00:00.000Z', '2026-10-10T17:00:00.000Z', 'published', NULL, 5, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (21, 1, 'Learn test', '2026-07-09T17:00:00.000Z', '2027-07-09T17:00:00.000Z', 'published', NULL, 5, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (22, 4, 'ENGLISH FOR COMPLETE BEGINNERS - MEETING PEOPLE', '2026-08-12T17:00:00.000Z', '2027-08-12T17:00:00.000Z', 'published', NULL, 31, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (23, 4, 'EVERYDAY ENGLISH', '2026-08-13T17:00:00.000Z', '2027-08-13T17:00:00.000Z', 'draft', NULL, 31, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (24, 1, 'English Begining for Newer', '2026-08-18T17:00:00.000Z', '2026-09-18T17:00:00.000Z', 'published', NULL, 5, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z'),
  (25, 1, 'Basic English Learning', '2026-08-20T17:00:00.000Z', '2026-10-14T17:00:00.000Z', 'published', NULL, 5, NULL, '0.00', '2026-08-20T01:15:14.407Z', '2026-08-20T01:15:14.407Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"courses"', 'course_id'), coalesce(max("course_id"), 1), max("course_id") IS NOT NULL) FROM "courses";

-- Dữ liệu bảng sections (17 records)
INSERT INTO "sections" ("section_id", "course_id", "title", "order_index", "created_at", "updated_at")
VALUES
  (1, 1, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (7, 5, 'Chương 1: Giới thiệu & Định hướng học tập', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (8, 5, 'Chương 2: Ngữ pháp phản xạ cơ bản (Reflexive Grammar)', 2, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (9, 5, 'Chương 3: Luyện nghe và phản xạ hội thoại', 3, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (11, 14, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (12, 15, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (13, 16, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (15, 18, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (16, 19, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (17, 20, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (18, 21, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (19, 22, '1 : Hello! Nice to Meet You', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (20, 22, '2: Personal Information', 2, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (21, 22, '3: Family and Friends', 3, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (22, 23, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (23, 24, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z'),
  (24, 25, 'Chương 1: Giới thiệu', 1, '2026-08-20T01:18:36.878Z', '2026-08-20T01:18:36.878Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"sections"', 'section_id'), coalesce(max("section_id"), 1), max("section_id") IS NOT NULL) FROM "sections";

-- Dữ liệu bảng lessons (33 records)
INSERT INTO "lessons" ("lesson_id", "section_id", "title", "content_type", "content_url", "order_index", "speaking_sentences", "speaking_questions", "lesson_comments", "pdf_version", "storage_provider", "storage_bucket", "storage_key", "mime_type", "size_bytes", "checksum_sha256", "media_status", "created_at", "updated_at")
VALUES
  (1, 1, '1. Chào mừng bạn đến với khóa học', 'pdf', '/uploads/courses/documents/Lesson_4_Mind_maps_1-1781751581672-591533863.pdf', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (10, 7, '1. Chào mừng & Hướng dẫn học tập hiệu quả cùng AI Assistant', 'video', '/uploads/courses/videos/Hello_and_Introductions-1786632893289-417948909.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (11, 7, '2. Cài đặt tư duy phản xạ tiếng Anh (English Mindset)', 'video', '/uploads/courses/videos/First_Conversation-1786632936208-662268121.mp4', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (12, 8, '3. Các thì thời gian trong văn phong nói (Speaking Tenses)', 'video', '/uploads/courses/videos/Meet_My_Family-1786633009416-291803778.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (13, 8, '4. Cấu trúc câu hỏi đuôi & Câu nghi vấn tự nhiên', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1782182982059-794809055.mp4', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (14, 9, '5. Phương pháp nghe thụ động (Passive Listening) & nghe chép chính tả', 'video', '/uploads/courses/videos/Huyen_Be___Grammar_14___Lesson_6___Section_2___Present_Continuous-1782791919011-104039874.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (16, 11, '1. Chào mừng bạn đến với khóa học', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1782182982059-794809055.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (17, 11, 'Bài học mới', 'pdf', '/uploads/courses/documents/Lesson_4_Mind_maps_1-1782183001697-585383107.pdf', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (18, 12, 'HIện tại tiếp diễn', 'video', '/uploads/courses/videos/Huyen_Be___Grammar_14___Lesson_6___Section_2___Present_Continuous-1782791919011-104039874.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (19, 12, 'Bài học mới', 'pdf', '/uploads/courses/documents/Hi___n_t___i_ti___p_di___n-1782791861417-123613820.pdf', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (20, 12, 'Bài học mới', 'pdf', '/uploads/courses/documents/_____ng_t____To_be-1782791877815-698041146.pdf', 3, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (21, 13, '1. Chào mừng bạn đến với khóa học', 'video', '/uploads/courses/videos/Huyen_Be___Grammar_14___Lesson_6___Section_2___Present_Continuous-1782872923893-392205751.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (22, 13, 'Bài học mới', 'pdf', '/uploads/courses/documents/Qu___kh________n-1782873166215-870063586.pdf', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (25, 15, '1. Chào mừng bạn đến với khóa học', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1783306722938-705588741.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (26, 15, 'Bài học mới', 'pdf', '/uploads/courses/documents/T__nh_t___-1783306741817-413892783.pdf', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (27, 16, '1. Chào mừng bạn đến với khóa học', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1783478966130-703284249.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (28, 16, 'Bài học mới', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Less5_Sec2-1783478976395-409991298.mp4', 2, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (29, 16, 'Bài học mới', 'pdf', '/uploads/courses/documents/T____ng_lai_____n___T____ng_lai_g___n-1783478992588-560780922.pdf', 3, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (30, 17, '1. Chào mừng bạn đến với khóa học', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1783565749004-576599358.mp4', 1, NULL, NULL, NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (31, 18, '1. Chào mừng bạn đến với khóa học', 'speaking', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1783651342405-499948717.mp4', 1, 'How are you today', 'What did you do last week
', NULL, 1, NULL, NULL, NULL, NULL, '0', NULL, NULL, '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (32, 18, 'Bài học mới', 'pdf', '/uploads/courses/documents/Lesson_4_Mind_maps_1_1_-1783651312378-265257723.pdf', 2, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (33, 18, 'Bài học mới', 'video', '/uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1783651319663-943656757.mp4', 3, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (34, 19, 'Bài học mới', 'pdf', '/uploads/courses/documents/CHUONG_1-1786632746043-224690222.pdf', 1, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (35, 19, 'First Meeting – Hello and Introductions', 'video', '/uploads/courses/videos/Hello_and_Introductions-1786632893289-417948909.mp4', 2, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (36, 20, 'Bài học mới', 'pdf', '/uploads/courses/documents/CHUONG_2-1786632915346-393321848.pdf', 1, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (37, 20, 'Talking About Yourself', 'video', '/uploads/courses/videos/First_Conversation-1786632936208-662268121.mp4', 2, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (38, 21, 'Bài học mới', 'pdf', '/uploads/courses/documents/CHUONG_3-1786632991484-384679518.pdf', 1, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (39, 21, 'Meet My Family', 'video', '/uploads/courses/videos/Meet_My_Family-1786633009416-291803778.mp4', 2, '', '', NULL, 1, 'supabase', 'videos', NULL, 'video/mp4', '0', NULL, 'MISSING_SOURCE', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (40, 22, '1. Chào mừng bạn đến với khóa học', 'video', '', 1, '', '', NULL, 1, NULL, NULL, NULL, NULL, '0', NULL, NULL, '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (41, 23, '1. Chào mừng bạn đến với khóa học', 'video', 'courses/5/36d2c325-7ca4-43b3-bfb2-8ec659a61c79/Everyday_Conversations.mp4', 1, '', 'What did you do yesterday?', NULL, 1, 'supabase', 'videos', 'courses/5/36d2c325-7ca4-43b3-bfb2-8ec659a61c79/Everyday_Conversations.mp4', 'video/mp4', '19396114', 'a06b798d730e39ce554d2dcfab0f35f405eb857898a8e704716a5c21a57e1142', 'READY', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (44, 24, 'Bài học mới', 'video', 'courses/5/eb5f9f73-a9c4-4fb3-9a71-57e2f8c1c752/L__m_Ch____Ti___ng_Anh_C___B___n.mp4', 1, 'Welcome to our class', 'What did you do last week?', NULL, 1, 'supabase', 'videos', 'courses/5/eb5f9f73-a9c4-4fb3-9a71-57e2f8c1c752/L__m_Ch____Ti___ng_Anh_C___B___n.mp4', 'video/mp4', '19511086', NULL, 'READY', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (45, 24, 'Everyday Conversation', 'video', 'courses/5/7c56e538-b941-4046-a405-5c1a0cc478a0/Everyday_Conversations.mp4', 2, '', 'What are you going to do in the evening?', NULL, 1, 'supabase', 'videos', 'courses/5/7c56e538-b941-4046-a405-5c1a0cc478a0/Everyday_Conversations.mp4', 'video/mp4', '19396114', 'a06b798d730e39ce554d2dcfab0f35f405eb857898a8e704716a5c21a57e1142', 'READY', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z'),
  (46, 24, 'Speak English Properly', 'video', 'courses/5/d972ebeb-5107-47c4-a469-ea4d3a92a1ee/Speak_English_Clearly.mp4', 3, '', '', NULL, 1, 'supabase', 'videos', 'courses/5/d972ebeb-5107-47c4-a469-ea4d3a92a1ee/Speak_English_Clearly.mp4', 'video/mp4', '18351854', 'eb9d43429d49d1fa9bbc31405461ebfebc4bdf1f400b2d1008e6f2578aba9918', 'READY', '2026-08-20T01:18:36.729Z', '2026-08-20T01:18:36.729Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"lessons"', 'lesson_id'), coalesce(max("lesson_id"), 1), max("lesson_id") IS NOT NULL) FROM "lessons";

-- Dữ liệu bảng quizzes (7 records)
INSERT INTO "quizzes" ("quiz_id", "course_id", "lesson_id", "title", "description", "difficulty", "time_limit", "created_at", "is_private", "pin_code", "updated_at")
VALUES
  (1, NULL, NULL, 'Speaking Tenses Quiz', 'Trắc nghiệm kiểm tra phản xạ về 3 thì cơ bản trong văn nói.', 'Medium', 10, '2026-07-02T06:11:40.045Z', FALSE, NULL, '2026-08-20T01:18:37.309Z'),
  (2, 5, 13, 'Tag Questions Quiz', 'Trắc nghiệm kiểm tra phản xạ về cấu trúc câu hỏi đuôi.', 'Medium', 10, '2026-07-02T06:11:40.045Z', FALSE, NULL, '2026-08-20T01:18:37.309Z'),
  (3, NULL, NULL, 'English Slangs & Idioms Quiz', 'Thử thách hiểu biết của bạn về tiếng lóng và các thành ngữ tiếng Anh giao tiếp thông dụng hàng ngày.', 'Medium', 5, '2026-07-02T06:11:40.045Z', FALSE, NULL, '2026-08-20T01:18:37.309Z'),
  (4, NULL, NULL, 'Travel English Essentials', 'Trang bị các mẫu câu giao tiếp tiếng Anh thiết thực tại sân bay, khách sạn, nhà hàng khi đi du lịch nước ngoài.', 'Easy', 8, '2026-07-02T06:11:40.045Z', FALSE, NULL, '2026-08-20T01:18:37.309Z'),
  (5, NULL, NULL, 'Creative English Challenge (AI Writing & Speaking)', 'Thách thức viết luận ngắn và luyện phát âm nói tiếng Anh tương tác trực tiếp với Trợ lý ảo AI.', 'Medium', 15, '2026-07-22T20:31:12.287Z', FALSE, NULL, '2026-08-20T01:18:37.309Z'),
  (6, NULL, NULL, 'Learning well', '', 'Medium', 15, '2026-08-02T19:38:26.946Z', TRUE, '212986', '2026-08-20T01:18:37.309Z'),
  (7, NULL, NULL, 'Test Quizz', '', 'Medium', 15, '2026-08-04T19:40:32.065Z', TRUE, '700299', '2026-08-20T01:18:37.309Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"quizzes"', 'quiz_id'), coalesce(max("quiz_id"), 1), max("quiz_id") IS NOT NULL) FROM "quizzes";

-- Dữ liệu bảng questions (38 records)
INSERT INTO "questions" ("question_id", "quiz_id", "question_text", "options", "correct_answer", "explanation", "created_at", "question_type", "updated_at")
VALUES
  (1, 1, 'Every morning, my brother __________ a cup of warm water before breakfast.', '["A. is drinking","B. drinks","C. drank","D. will drink"]', 'B', 'Thì hiện tại đơn diễn tả một thói quen hàng ngày (Every morning). Chủ ngữ ''my brother'' số ít nên động từ chia là ''drinks''.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (2, 1, 'Yesterday, she __________ to the library to borrow some grammar books.', '["A. goes","B. was going","C. went","D. will go"]', 'C', 'Dấu hiệu nhận biết ''Yesterday'' chỉ hành động xảy ra và kết thúc trong quá khứ, chia thì Quá khứ đơn (went).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (3, 1, 'I promise I __________ you with your English homework tomorrow evening.', '["A. will help","B. help","C. helped","D. helping"]', 'A', 'Dấu hiệu nhận biết lời hứa (I promise) kết hợp với mốc thời gian tương lai (tomorrow) dùng thì Tương lai đơn (will help).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (4, 1, 'Look! The students __________ English in the classroom.', '["A. practice","B. are practicing","C. practiced","D. will practice"]', 'B', 'Từ cảm thán ''Look!'' (Nhìn kìa!) báo hiệu hành động đang xảy ra tại thời điểm nói, chia thì Hiện tại tiếp diễn (are practicing).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (5, 1, 'At 8 PM yesterday, we __________ a video lesson on speaking reflexes.', '["A. watch","B. are watching","C. were watching","D. will watch"]', 'C', 'Hành động đang diễn ra tại một thời điểm cụ thể trong quá khứ (At 8 PM yesterday) chia thì Quá khứ tiếp diễn (were watching).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (6, 2, 'You aren''t going to the English club today, __________?', '["A. are you","B. aren''t you","C. do you","D. don''t you"]', 'A', 'Mệnh đề chính ở thể phủ định (aren''t), phần hỏi đuôi phải ở thể khẳng định (are you).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (7, 2, 'She plays the piano beautifully, __________?', '["A. is she","B. does she","C. doesn''t she","D. isn''t she"]', 'C', 'Mệnh đề chính dùng động từ thường ở thể khẳng định (plays), phần hỏi đuôi dùng trợ động từ phù hợp ở thể phủ định (doesn''t she).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (8, 2, 'Let''s go out for a walk in the park, __________?', '["A. shall we","B. will you","C. do we","D. don''t we"]', 'A', 'Câu rủ rê bắt đầu bằng ''Let''s'' thì câu hỏi đuôi mặc định luôn là ''shall we''.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (9, 2, 'He has never been to London before, __________?', '["A. hasn''t he","B. has he","C. did he","D. didn''t he"]', 'B', 'Câu chứa trạng từ phủ định ''never'' (chưa bao giờ), do đó mệnh đề chính mang nghĩa phủ định, phần hỏi đuôi phải ở thể khẳng định (has he).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (10, 2, 'Nobody called me last night, __________?', '["A. did they","B. didn''t they","C. did he","D. didn''t he"]', 'A', 'Chủ ngữ phủ định ''Nobody'' được thay thế bằng đại từ ''they'' ở phần hỏi đuôi. Mệnh đề chính mang nghĩa phủ định nên đuôi phải là khẳng định (did they).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (11, 3, 'When someone says ''Break a leg!'', what do they mean?', '["A. Go hurt yourself","B. Good luck","C. Hurry up","D. Be quiet"]', 'B', '''Break a leg'' là thành ngữ tiếng Anh dùng để chúc ai đó may mắn trước khi họ lên sân khấu biểu diễn.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (12, 3, 'If a task is ''a piece of cake'', it is __________.', '["A. very delicious","B. extremely easy","C. complicated","D. expensive"]', 'B', '''A piece of cake'' là thành ngữ ví von một việc gì đó cực kỳ dễ dàng để hoàn thành.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (13, 3, 'What does ''cost an arm and a leg'' mean?', '["A. Very cheap","B. Painful","C. Extremely expensive","D. Dangerous"]', 'C', '''Cost an arm and a leg'' diễn tả một món đồ hoặc dịch vụ có giá cắt cổ, rất đắt đỏ.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (14, 3, 'Choose the meaning of the slang: ''I feel under the weather today.''', '["A. I feel sick","B. I like the weather","C. I am happy","D. I want to go out"]', 'A', '''Under the weather'' là trạng thái cảm thấy không được khỏe, mệt mỏi trong người.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (15, 3, 'When you ''hit the sack'', you __________.', '["A. play football","B. clean the room","C. go to sleep","D. pack bags"]', 'C', '''Hit the sack'' (hoặc ''hit the hay'') có nghĩa là đi ngủ.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (16, 4, 'At the airport check-in counter, which phrase is used to ask for a seat near the window?', '["A. I''d like an aisle seat, please.","B. I''d like a window seat, please.","C. Can I sit on the wing?","D. Where is the gate?"]', 'B', '''Window seat'' là ghế ngồi sát cửa sổ máy bay.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (17, 4, 'When checking into a hotel, what should you ask if you want breakfast included?', '["A. Is breakfast free?","B. Is breakfast included?","C. What time is dinner?","D. Do you have breakfast?"]', 'B', 'Cấu trúc thông dụng: ''Is breakfast included?'' (Bữa sáng đã bao gồm trong tiền phòng chưa?).', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (18, 4, 'In a restaurant, what is the most polite way to ask for the bill/check?', '["A. Bring me the bill!","B. Could we have the bill, please?","C. I want to pay now.","D. Money, please."]', 'B', '''Could we have the bill, please?'' là cách hỏi tính tiền lịch sự nhất.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (19, 4, 'What does a traveler mean when they ask: ''Where is the baggage claim?''', '["A. Nơi ký gửi hành lý","B. Nơi nhận lại hành lý sau chuyến bay","C. Nơi mua túi xách","D. Quầy làm thủ tục"]', 'B', '''Baggage claim'' là khu vực băng chuyền lấy lại hành lý ký gửi sau khi hạ cánh.', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (20, 4, 'If you get lost and want to ask the way to the subway station, you say: __________', '["A. Where subway?","B. Could you show me the way to the subway station, please?","C. I want subway station.","D. Take me to subway."]', 'B', 'Cách hỏi đường lịch sự: ''Could you show me the way to..., please?''', '2026-07-02T06:11:40.045Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (27, 1, 'introduce yourself', NULL, 'it include your first and last name, age, your goals', NULL, '2026-07-19T22:07:58.587Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (28, 1, 'what did you expect from this course', NULL, 'what do you think about our website', NULL, '2026-07-19T22:07:58.587Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (29, 1, 'read the following sentence: how are you today', NULL, 'assesss pronunciation, stress, intonation and fluency', NULL, '2026-07-19T22:07:58.587Z', 'pronunciation', '2026-08-20T01:18:37.454Z'),
  (30, 1, 'pronunciation the word: photosysnthesis', NULL, 'the action when people use to breath', NULL, '2026-07-19T22:07:58.587Z', 'pronunciation', '2026-08-20T01:18:37.454Z'),
  (31, 1, 'the meaning of this word: sphygmomanometer', NULL, 'blood pressure monitor', NULL, '2026-07-19T22:07:58.587Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (32, 5, 'Describe your favorite English learning method in 2-3 sentences. Why do you like it?', '[]', '', 'AI Trợ lý ảo sẽ tự động phân tích ngữ pháp, chính tả, cách dùng từ và đề xuất bài viết mẫu tối ưu.', '2026-07-22T20:31:12.417Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (33, 5, 'Read the following sentence aloud with clear pronunciation and natural intonation.', '[]', 'English has become a global language for communication and education.', 'Đọc to rõ ràng câu mẫu. AI sẽ tự động phân tích giọng nói của bạn để chấm điểm và chỉ ra lỗi phát âm cụ thể.', '2026-07-22T20:31:12.417Z', 'pronunciation', '2026-08-20T01:18:37.454Z'),
  (34, 5, 'Write a short paragraph (3-4 sentences) about what you did yesterday.', '[]', '', 'Tập viết câu chuyện quá khứ sử dụng Thì quá khứ đơn (Past Simple). Trợ lý AI sẽ sửa lỗi ngữ pháp thì cho bạn.', '2026-07-22T20:31:12.417Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (35, 6, 'Which of the following best describes a globe?', '["A. A flat representation of the Earth or a part of it.","B. A spherical model of the Earth.","C. A book containing maps of different regions.","D. A digital image showing weather patterns."]', 'B', 'Quả địa cầu là một mô hình Trái Đất có hình cầu, giúp mô phỏng chính xác nhất hình dạng và vị trí tương đối của các lục địa, đại dương trên Trái Đất. Các lựa chọn khác mô tả bản đồ (A, C) hoặc hình ảnh vệ tinh (D).', '2026-08-02T19:38:26.946Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (36, 6, 'In 2-3 sentences, explain why a globe is considered a more accurate representation of the Earth than a flat map for certain purposes.', '[]', 'A', 'Hãy tập trung vào việc sử dụng các từ vựng liên quan đến địa lý như ''spherical shape'' (hình cầu), ''distortion'' (sự biến dạng), ''relative size and distance'' (kích thước và khoảng cách tương đối). Về ngữ pháp, hãy chú ý sử dụng các câu phức để diễn đạt ý so sánh và đối lập một cách rõ ràng.', '2026-08-02T19:38:26.946Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (37, 6, 'Read the following sentence aloud:', '[]', 'The globe provides a true perspective of Earth''s continents and oceans.', 'Để phát âm câu này, hãy chú ý: 
*   **Ngữ điệu (Intonation)**: Bắt đầu ở âm vực trung bình, lên giọng nhẹ ở ''perspective'' và xuống giọng ở cuối câu ''oceans'' để thể hiện một câu trần thuật.
*   **Trọng âm từ (Word Stress)**: Đặt trọng âm vào các từ khóa như ''globe'', ''true per**spec**tive'', ''**Earth''s**'', ''**con**tinents'', ''**o**ceans''.
*   **Nối âm (Linking)**: ''perspective of'' có thể nối thành /pərˈspɛktɪvəv/. ''Earth''s continents'' cũng có thể có một sự nối âm nhẹ giữa ''s'' và ''c''.', '2026-08-02T19:38:26.946Z', 'pronunciation', '2026-08-20T01:18:37.454Z'),
  (38, 6, 'What do the horizontal lines running across a globe represent?', '["A. Lines of longitude","B. Lines of latitude","C. Equator","D. Prime Meridian"]', 'B', 'Các đường ngang chạy song song với đường xích đạo trên quả địa cầu được gọi là đường vĩ tuyến (lines of latitude), dùng để xác định vị trí Bắc - Nam. Đường xích đạo (C) là một đường vĩ tuyến đặc biệt (0 độ). Đường kinh tuyến (A) là các đường dọc. Kinh tuyến gốc (D) là một đường kinh tuyến đặc biệt (0 độ).', '2026-08-02T19:38:26.946Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (39, 6, 'Describe two main advantages of using a globe compared to a two-dimensional map when studying geography. Write 2-3 sentences.', '[]', 'A', 'Tập trung vào các ưu điểm của quả địa cầu như thể hiện hình dạng Trái Đất (spherical shape) và tránh sự biến dạng (minimize distortion) về kích thước, hình dạng, khoảng cách, và diện tích. Sử dụng các cấu trúc câu so sánh (e.g., ''more accurate than'', ''unlike flat maps'') và từ vựng như ''true scale'', ''relative proportions''.', '2026-08-02T19:38:26.946Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (40, 7, 'What is typically a defining characteristic of a sovereign nation?', '["A. Universal adoption of a single global currency.","B. Membership in the United Nations.","C. A defined territory and a permanent population.","D. Exclusive use of a specific language by all its citizens."]', 'C', 'Giải thích: Một quốc gia có chủ quyền thường được định nghĩa bởi các yếu tố cơ bản như lãnh thổ xác định, dân số thường trú, chính phủ và khả năng thiết lập quan hệ với các quốc gia khác. Việc có một lãnh thổ xác định và dân số thường trú là hai trong số các đặc điểm cốt lõi nhất. Các lựa chọn khác không phải là đặc điểm định nghĩa chung (universally defining characteristics).', '2026-08-04T19:40:32.065Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (41, 7, 'Describe in 2-3 sentences two significant challenges that many nations around the world currently face and how these challenges might be interconnected.', '[]', 'A', 'Giải thích: Khi viết, hãy tập trung vào việc sử dụng các từ vựng liên quan đến các vấn đề toàn cầu (ví dụ: biến đổi khí hậu, an ninh lương thực, xung đột, kinh tế toàn cầu, đại dịch) và các cấu trúc câu phức để thể hiện mối liên hệ giữa các thách thức (ví dụ: "not only... but also", "furthermore", "consequently"). Đảm bảo sử dụng ngữ pháp chính xác, đặc biệt là thì hiện tại đơn hoặc thì hiện tại hoàn thành để nói về các thách thức đang diễn ra.', '2026-08-04T19:40:32.065Z', 'writing', '2026-08-20T01:18:37.454Z'),
  (42, 7, 'Which international organization primarily aims to promote peace and cooperation among nations globally?', '["A. World Health Organization (WHO)","B. International Monetary Fund (IMF)","C. United Nations (UN)","D. World Trade Organization (WTO)"]', 'C', 'Giải thích: Liên Hợp Quốc (UN) được thành lập với mục tiêu chính là duy trì hòa bình và an ninh quốc tế, phát triển quan hệ hữu nghị giữa các quốc gia và thúc đẩy hợp tác quốc tế trong việc giải quyết các vấn đề kinh tế, xã hội, văn hóa và nhân đạo. Các tổ chức khác có mục tiêu cụ thể hơn về y tế, tài chính hoặc thương mại.', '2026-08-04T19:40:32.065Z', 'multiple_choice', '2026-08-20T01:18:37.454Z'),
  (43, 7, 'Please read the following sentence aloud:', '[]', 'Every nation, despite its unique culture and history, shares common aspirations for peace and prosperity.', 'Giải thích: Khi đọc câu này, hãy chú ý đến trọng âm của từ và ngữ điệu.
- Trọng âm của từ: Nhấn mạnh vào các từ quan trọng như "every nation", "unique culture", "history", "common aspirations", "peace", "prosperity".
- Ngữ điệu:
    - Nâng giọng nhẹ ở cụm từ "despite its unique culture and history" để tạo ra một sự tương phản.
    - Hạ giọng ở cuối câu, đặc biệt là từ "prosperity", để chỉ ra sự kết thúc của ý tưởng.
    - Đảm bảo đọc rõ ràng và tự nhiên, không vội vàng.', '2026-08-04T19:40:32.065Z', 'pronunciation', '2026-08-20T01:18:37.454Z'),
  (44, 7, 'In 2-3 sentences, discuss how a nation''s geographical location can influence its economic development and international relations.', '[]', 'A', 'Giải thích: Khi trả lời, hãy tập trung vào việc sử dụng các từ vựng miêu tả vị trí địa lý (ví dụ: "landlocked", "coastal", "strategic location", "proximity to trade routes", "natural resources") và các từ nối để diễn tả mối quan hệ nhân quả (ví dụ: "consequently", "as a result", "therefore", "due to"). Đảm bảo cấu trúc câu rõ ràng và ngữ pháp chính xác để trình bày ý tưởng một cách mạch lạc.', '2026-08-04T19:40:32.065Z', 'writing', '2026-08-20T01:18:37.454Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"questions"', 'question_id'), coalesce(max("question_id"), 1), max("question_id") IS NOT NULL) FROM "questions";

-- Dữ liệu bảng quiz_attempts (20 records)
INSERT INTO "quiz_attempts" ("attempt_id", "user_id", "quiz_id", "score", "completed_at", "nickname")
VALUES
  (1, NULL, 3, 0, '2026-07-23T05:39:14.593Z', 'TestGuest'),
  (2, 4, 3, 40, '2026-07-29T22:20:00.859Z', 'sky3337 '),
  (3, 4, 5, 0, '2026-07-29T22:45:29.016Z', 'sky3337 '),
  (4, 4, 1, 20, '2026-07-30T03:16:13.591Z', 'sky3337 '),
  (5, 4, 1, 30, '2026-08-04T19:38:43.399Z', 'sky3337 '),
  (6, 4, 5, 0, '2026-08-04T19:39:26.991Z', 'sky3337 '),
  (7, 4, 4, 60, '2026-08-05T20:46:53.184Z', 'sky3337 '),
  (8, 18, 4, 60, '2026-08-14T07:00:33.379Z', '2200002309'),
  (9, 3, 1, 85, '2026-08-16T22:45:07.748Z', NULL),
  (10, 3, 2, 90, '2026-08-15T22:45:07.748Z', NULL),
  (11, 3, 3, 78, '2026-08-14T22:45:07.748Z', NULL),
  (12, 35, 1, 95, '2026-08-12T00:19:27.324Z', 'Demo Student'),
  (13, 35, 2, 88, '2026-08-13T00:19:27.324Z', 'Demo Student'),
  (14, 35, 3, 92, '2026-08-14T00:19:27.324Z', 'Demo Student'),
  (15, 36, 1, 70, '2026-08-15T00:19:27.324Z', 'Hoang Nhat Nam'),
  (16, 36, 4, 82, '2026-08-16T00:19:27.324Z', 'Hoang Nhat Nam'),
  (17, 38, 2, 65, '2026-08-09T00:19:27.324Z', 'Nguyen Thanh Bing'),
  (18, 38, 5, 78, '2026-08-11T00:19:27.324Z', 'Nguyen Thanh Bing'),
  (19, 39, 3, 85, '2026-08-17T00:19:27.324Z', 'Not Phuc but Phuck'),
  (20, 39, 6, 91, '2026-08-18T00:19:27.324Z', 'Not Phuc but Phuck')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"quiz_attempts"', 'attempt_id'), coalesce(max("attempt_id"), 1), max("attempt_id") IS NOT NULL) FROM "quiz_attempts";

-- Dữ liệu bảng user_progress (63 records)
INSERT INTO "user_progress" ("progress_id", "user_id", "lesson_id", "is_completed", "completed_at", "updated_at")
VALUES
  (3, 4, 1, TRUE, '2026-06-29T20:51:43.578Z', '2026-06-29T20:51:44.593Z'),
  (8, 5, 25, TRUE, '2026-07-09T19:27:36.181Z', '2026-07-09T19:27:36.181Z'),
  (9, 18, 31, TRUE, '2026-08-04T18:49:38.499Z', '2026-08-04T18:49:38.499Z'),
  (10, 18, 32, TRUE, '2026-08-13T03:30:35.260Z', '2026-08-13T03:30:35.784Z'),
  (16, 31, 35, FALSE, NULL, '2026-08-13T19:36:44.653Z'),
  (33, 18, 10, TRUE, '2026-08-14T06:58:13.313Z', '2026-08-14T06:58:13.313Z'),
  (34, 18, 12, TRUE, '2026-08-14T06:59:46.982Z', '2026-08-14T06:59:46.982Z'),
  (35, 18, 11, TRUE, '2026-08-14T06:59:47.478Z', '2026-08-14T06:59:47.478Z'),
  (36, 18, 13, TRUE, '2026-08-14T06:59:49.080Z', '2026-08-14T06:59:49.080Z'),
  (37, 18, 14, TRUE, '2026-08-14T06:59:52.439Z', '2026-08-14T06:59:52.439Z'),
  (38, 18, 33, TRUE, '2026-08-14T07:13:49.630Z', '2026-08-14T07:13:49.630Z'),
  (40, 18, 1, TRUE, '2026-08-14T23:08:52.261Z', '2026-08-14T23:08:52.261Z'),
  (42, 18, 16, TRUE, '2026-08-14T23:09:38.606Z', '2026-08-14T23:09:38.606Z'),
  (57, 3, 1, TRUE, '2026-08-17T03:42:37.711Z', '2026-08-17T03:42:37.711Z'),
  (58, 3, 10, TRUE, '2026-08-16T03:42:37.711Z', '2026-08-16T03:42:37.711Z'),
  (59, 3, 11, TRUE, '2026-08-15T03:42:37.711Z', '2026-08-15T03:42:37.711Z'),
  (60, 3, 16, TRUE, '2026-08-14T03:42:37.711Z', '2026-08-14T03:42:37.711Z'),
  (61, 3, 18, TRUE, '2026-08-13T03:42:37.711Z', '2026-08-13T03:42:37.711Z'),
  (62, 3, 19, TRUE, '2026-08-12T03:42:37.711Z', '2026-08-12T03:42:37.711Z'),
  (63, 3, 20, TRUE, '2026-08-11T03:42:37.711Z', '2026-08-11T03:42:37.711Z'),
  (64, 3, 21, TRUE, '2026-08-10T03:42:37.711Z', '2026-08-10T03:42:37.711Z'),
  (65, 3, 22, TRUE, '2026-08-09T03:42:37.711Z', '2026-08-09T03:42:37.711Z'),
  (66, 3, 25, TRUE, '2026-08-08T03:42:37.711Z', '2026-08-08T03:42:37.711Z'),
  (67, 3, 26, TRUE, '2026-08-07T03:42:37.711Z', '2026-08-07T03:42:37.711Z'),
  (68, 3, 27, TRUE, '2026-08-06T03:42:37.711Z', '2026-08-06T03:42:37.711Z'),
  (69, 3, 28, TRUE, '2026-08-05T03:42:37.711Z', '2026-08-05T03:42:37.711Z'),
  (70, 3, 29, TRUE, '2026-08-04T03:42:37.711Z', '2026-08-04T03:42:37.711Z'),
  (71, 3, 30, TRUE, '2026-08-03T03:42:37.711Z', '2026-08-03T03:42:37.711Z'),
  (72, 3, 31, TRUE, '2026-08-02T03:42:37.711Z', '2026-08-02T03:42:37.711Z'),
  (73, 3, 32, TRUE, '2026-08-01T03:42:37.711Z', '2026-08-01T03:42:37.711Z'),
  (74, 3, 33, TRUE, '2026-07-31T03:42:37.711Z', '2026-07-31T03:42:37.711Z'),
  (75, 3, 40, TRUE, '2026-07-30T03:42:37.711Z', '2026-07-30T03:42:37.711Z'),
  (77, 36, 21, TRUE, '2026-08-02T03:54:59.456Z', '2026-08-02T03:54:59.456Z'),
  (78, 36, 22, TRUE, '2026-07-31T03:54:59.456Z', '2026-07-31T03:54:59.456Z'),
  (79, 36, 25, TRUE, '2026-07-29T03:54:59.456Z', '2026-07-29T03:54:59.456Z'),
  (80, 36, 26, TRUE, '2026-07-27T03:54:59.456Z', '2026-07-27T03:54:59.456Z'),
  (81, 36, 27, TRUE, '2026-07-25T03:54:59.456Z', '2026-07-25T03:54:59.456Z'),
  (87, 38, 10, TRUE, '2026-08-08T03:56:57.364Z', '2026-08-08T03:56:57.364Z'),
  (88, 38, 22, TRUE, '2026-08-05T03:56:57.364Z', '2026-08-05T03:56:57.364Z'),
  (89, 38, 21, TRUE, '2026-08-01T03:56:57.364Z', '2026-08-01T03:56:57.364Z'),
  (90, 38, 26, TRUE, '2026-07-24T03:56:57.364Z', '2026-07-24T03:56:57.364Z'),
  (91, 38, 32, TRUE, '2026-07-22T03:56:57.364Z', '2026-07-22T03:56:57.364Z'),
  (92, 39, 10, TRUE, '2026-08-09T04:01:35.355Z', '2026-08-09T04:01:35.355Z'),
  (93, 39, 22, TRUE, '2026-08-08T04:01:35.355Z', '2026-08-08T04:01:35.355Z'),
  (94, 39, 21, TRUE, '2026-08-05T04:01:35.355Z', '2026-08-05T04:01:35.355Z'),
  (95, 39, 26, TRUE, '2026-08-03T04:01:35.355Z', '2026-08-03T04:01:35.355Z'),
  (96, 39, 32, TRUE, '2026-08-02T04:01:35.355Z', '2026-08-02T04:01:35.355Z'),
  (97, 35, 1, TRUE, '2026-08-13T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (98, 35, 10, TRUE, '2026-08-14T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (99, 35, 11, TRUE, '2026-08-15T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (100, 35, 16, TRUE, '2026-08-16T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (101, 35, 18, TRUE, '2026-08-17T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (102, 35, 21, TRUE, '2026-08-18T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (103, 35, 25, TRUE, '2026-08-19T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (104, 35, 26, TRUE, '2026-08-09T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (105, 35, 27, TRUE, '2026-08-07T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (106, 35, 28, TRUE, '2026-08-05T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (107, 35, 29, TRUE, '2026-08-03T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (108, 35, 30, TRUE, '2026-08-01T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (109, 35, 31, TRUE, '2026-07-30T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (110, 35, 32, TRUE, '2026-07-28T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (111, 35, 33, TRUE, '2026-07-26T00:18:45.200Z', '2026-08-19T00:18:45.200Z'),
  (112, 35, 40, TRUE, '2026-07-23T00:18:45.200Z', '2026-08-19T00:18:45.200Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"user_progress"', 'progress_id'), coalesce(max("progress_id"), 1), max("progress_id") IS NOT NULL) FROM "user_progress";

-- Dữ liệu bảng ai_chat (6 records)
INSERT INTO "ai_chat" ("ai_chat", "student_id", "created_at", "title", "sender_type", "lesson_id")
VALUES
  (187, 5, '2026-08-20T01:17:26.430Z', 'Giải thích ngắn gọn những điểm ngữ pháp và cấu trúc câu chính trong bài học này.', 'user', 44),
  (188, 5, '2026-08-20T01:17:26.571Z', '{"answer":"Chào bạn! Rất vui được đồng hành cùng bạn trên con đường chinh phục tiếng Anh nhé! \n\nHôm nay hệ thống chưa có sẵn nội dung bài học cụ thể nào để mình cùng xem xét cả. Không sao hết nha! Bạn có thể gửi cho mình đoạn văn, bài hội thoại, hoặc bất kỳ điểm ngữ pháp nào mà bạn đang thắc mắc. \n\nMình luôn sẵn sàng giải thích chi tiết, cho ví dụ dễ hiểu và cùng bạn luyện tập mỗi ngày. Bạn muốn chúng ta bắt đầu với chủ đề gì nào?","sources":[{"courseId":25,"courseName":"Basic English Learning","sectionId":24,"sectionTitle":"Chương 1: Giới thiệu","lessonId":44,"lessonTitle":"Bài học mới","contentType":"video","sourceType":"transcript","relevanceScore":1,"badgeText":"Nội dung bài học hiện tại"}],"actions":[{"type":"OPEN_LESSON","lessonId":44,"courseId":25,"lessonTitle":"Bài học mới","route":"/lessons/44"}]}', 'bot', 44),
  (189, 5, '2026-08-20T05:34:30.727Z', 'Giải thích ngắn gọn những điểm ngữ pháp và cấu trúc câu chính trong bài học này.', 'user', 41),
  (190, 5, '2026-08-20T05:34:30.869Z', '{"answer":"Chào bạn! Rất vui được đồng hành cùng bạn trong bài học hôm nay nhé. \n\nĐể mình tóm tắt lại những điểm ngữ pháp và cấu trúc câu chính mà chúng ta vừa tìm hiểu một cách thật dễ hiểu nha! Bài học hôm nay xoay quanh **Đại từ nhân xưng làm chủ ngữ (Subject Pronouns)** và **Đại từ tân ngữ (Object Pronouns)**. \n\nCụ thể như sau:\n\n### 1. Đại từ chủ ngữ (Subject Pronouns)\n* **Vị trí:** Luôn đứng **trước động từ chính** trong câu để chỉ người hoặc vật thực hiện hành động.\n* **Các từ bao gồm:** *I* (tôi), *You* (bạn/các bạn), *We* (chúng tôi/chúng ta), *They* (họ/chúng nó), *He* (anh ấy), *She* (cô ấy), *It* (nó).\n* **Ví dụ:** **I** see them. (*Tôi* nhìn thấy họ - trong đó \"I\" đứng trước động từ \"see\").\n\n### 2. Đại từ tân ngữ (Object Pronouns)\n* **Vị trí:** Luôn đứng **sau động từ chính hoặc sau giới từ** để chỉ người hoặc vật nhận tác động của hành động.\n* **Các từ bao gồm:** *Me* (tôi), *You* (bạn), *Us* (chúng tôi), *Them* (họ), *Him* (anh ấy), *Her* (cô ấy), *It* (nó).\n* **Ví dụ:** She helps **him**. (Cô ấy giúp *anh ấy* - trong đó \"him\" đứng sau động từ \"helps\").\n\n### 3. Cấu trúc câu chủ đạo\nCấu trúc cơ bản nhất mà bạn cần nhớ là:\n> **[Đại từ chủ ngữ] + [Động từ] + [Đại từ tân ngữ]**\n\n*Ví dụ tổng hợp:* \n* **They** see **me**. (*Họ* nhìn thấy *tôi*.)\n* We listen to **them**. (*Chúng tôi* lắng nghe *họ*.)\n\nBạn hãy chú ý thật kỹ đến **vị trí đứng trước hay sau động từ** của các từ này để không bị nhầm lẫn khi đặt câu nhé. Nếu bạn còn chỗ nào chưa rõ, cứ hỏi mình ngay nha!","sources":[{"courseId":24,"courseName":"English Begining for Newer","sectionId":23,"sectionTitle":"Chương 1: Giới thiệu","lessonId":41,"lessonTitle":"1. Chào mừng bạn đến với khóa học","contentType":"video","sourceType":"transcript","relevanceScore":1,"badgeText":"Nội dung bài học hiện tại (00:04)","startTime":4.2,"endTime":8.5,"formattedTime":"00:04"}],"actions":[{"type":"SEEK_VIDEO","lessonId":41,"courseId":24,"lessonTitle":"1. Chào mừng bạn đến với khóa học","startTime":4.2,"formattedTime":"00:04","route":"/lessons/41?seek=4.2"}]}', 'bot', 41),
  (191, 5, '2026-08-20T05:34:53.228Z', 'video này đang nói về bài học gì', 'user', 41),
  (192, 5, '2026-08-20T05:34:53.369Z', '{"answer":"Chào bạn! Ở video này, chúng ta đang học về **Đại từ chủ ngữ (Subject Pronouns)** và **Đại từ tân ngữ (Object Pronouns)** trong tiếng Anh đấy bạn ạ. \n\nCô/thầy giáo trong video đang hướng dẫn mình cách phân biệt và sử dụng chúng qua câu ví dụ rất dễ hiểu như *\"I see them\"* (Tôi nhìn thấy họ). \n\nTrong đó:\n- **Đại từ chủ ngữ** (như *I, You, We, They, He, She, It*) sẽ đứng trước động từ chính.\n- **Đại từ tân ngữ** (như *Me, You, Us, Them, Him, Her, It*) sẽ đứng sau động từ hoặc giới từ.\n\nBạn có muốn cùng mình lấy thêm vài ví dụ để luyện tập phần này luôn không nào?","sources":[{"courseId":24,"courseName":"English Begining for Newer","sectionId":23,"sectionTitle":"Chương 1: Giới thiệu","lessonId":41,"lessonTitle":"1. Chào mừng bạn đến với khóa học","contentType":"video","sourceType":"transcript","relevanceScore":1,"badgeText":"Nội dung bài học hiện tại (00:25)","startTime":25.8,"endTime":31.5,"formattedTime":"00:25"}],"actions":[{"type":"SEEK_VIDEO","lessonId":41,"courseId":24,"lessonTitle":"1. Chào mừng bạn đến với khóa học","startTime":25.8,"formattedTime":"00:25","route":"/lessons/41?seek=25.8"}]}', 'bot', 41)
ON CONFLICT DO NOTHING;

-- Dữ liệu bảng user_token_limits (7 records)
INSERT INTO "user_token_limits" ("token_limit_id", "user_id", "max_tokens", "used_tokens", "remaining_tokens", "reset_date", "created_at", "updated_at")
VALUES
  (8, 14, 10000, 0, 10000, '2026-07-17T17:00:00.000Z', '2026-07-17T20:14:35.663Z', '2026-07-17T20:14:35.663Z'),
  (9, 17, 10000, 0, 10000, '2026-07-17T17:00:00.000Z', '2026-07-17T20:14:35.663Z', '2026-07-17T20:14:35.663Z'),
  (10, 18, 6000, 0, 6000, '2026-08-17T17:00:00.000Z', '2026-07-17T20:14:35.663Z', '2026-08-18T07:13:37.636Z'),
  (11, 3, 10000, 0, 10000, '2026-07-17T17:00:00.000Z', '2026-07-17T20:14:35.663Z', '2026-07-17T20:14:35.663Z'),
  (12, 4, 999999999, 0, 999999999, '2026-08-18T17:00:00.000Z', '2026-07-30T03:54:26.974Z', '2026-08-19T06:11:19.567Z'),
  (13, 32, 6000, 0, 6000, '2026-08-13T17:00:00.000Z', '2026-08-13T19:21:03.580Z', '2026-08-13T19:21:03.580Z'),
  (14, 5, 7000, 0, 7000, '2026-08-19T17:00:00.000Z', '2026-08-16T02:22:16.145Z', '2026-08-20T01:17:23.167Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"user_token_limits"', 'token_limit_id'), coalesce(max("token_limit_id"), 1), max("token_limit_id") IS NOT NULL) FROM "user_token_limits";

-- Dữ liệu bảng lesson_comments (12 records)
INSERT INTO "lesson_comments" ("comment_id", "lesson_id", "user_id", "parent_id", "content", "is_pinned", "created_at", "updated_at")
VALUES
  (15, 10, 35, NULL, 'Bài học AI Assistant rất dễ hiểu, em áp dụng được ngay.', FALSE, '2026-08-14T06:14:10.327Z', '2026-08-19T06:14:10.327Z'),
  (16, 10, 36, NULL, 'Mình cũng thấy phần AI hỗ trợ luyện Speaking khá hay.', FALSE, '2026-08-15T06:14:10.327Z', '2026-08-19T06:14:10.327Z'),
  (17, 11, 38, NULL, 'Video không có tiếng mặc dù loa bị hư', FALSE, '2026-08-16T06:14:10.327Z', '2026-08-19T06:14:10.327Z'),
  (18, 11, 34, NULL, 'Giảng viên đã bổ sung tài liệu trong phần Resources nhé.', TRUE, '2026-08-16T06:14:10.327Z', '2026-08-19T06:14:10.327Z'),
  (19, 18, 39, NULL, 'Thì hiện tại tiếp diễn và hiện tại đơn dễ nhầm quá', FALSE, '2026-08-17T06:14:10.327Z', '2026-08-19T06:14:10.327Z'),
  (20, 18, 35, NULL, 'Bạn thử xem lại phần ví dụ ở cuối bài nhé.', FALSE, '2026-08-17T06:14:10.327Z', '2026-08-19T06:14:10.327Z'),
  (21, 10, 35, NULL, 'Bài học AI Assistant rất dễ hiểu, em áp dụng được ngay.', FALSE, '2026-08-14T23:05:38.742Z', '2026-08-19T23:05:38.742Z'),
  (22, 10, 36, NULL, 'Mình cũng thấy phần AI hỗ trợ luyện Speaking khá hay.', FALSE, '2026-08-15T23:05:38.742Z', '2026-08-19T23:05:38.742Z'),
  (23, 11, 38, NULL, 'Video không có tiếng mặc dù loa bị hư', FALSE, '2026-08-16T23:05:38.742Z', '2026-08-19T23:05:38.742Z'),
  (24, 11, 34, NULL, 'Giảng viên đã bổ sung tài liệu trong phần Resources nhé.', TRUE, '2026-08-16T23:05:38.742Z', '2026-08-19T23:05:38.742Z'),
  (25, 18, 39, NULL, 'Thì hiện tại tiếp diễn và hiện tại đơn dễ nhầm quá', FALSE, '2026-08-17T23:05:38.742Z', '2026-08-19T23:05:38.742Z'),
  (26, 18, 35, NULL, 'Bạn thử xem lại phần ví dụ ở cuối bài nhé.', FALSE, '2026-08-17T23:05:38.742Z', '2026-08-19T23:05:38.742Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"lesson_comments"', 'comment_id'), coalesce(max("comment_id"), 1), max("comment_id") IS NOT NULL) FROM "lesson_comments";

-- Dữ liệu bảng learning_ss (65 records)
INSERT INTO "learning_ss" ("learning_ss_id", "user_id", "lesson_id", "start_at", "end_at")
VALUES
  (5, 5, 1, '2026-08-07T01:00:00.000Z', '2026-08-07T01:45:00.000Z'),
  (6, 5, 1, '2026-08-08T02:00:00.000Z', '2026-08-08T03:00:00.000Z'),
  (7, 5, 1, '2026-08-09T12:00:00.000Z', '2026-08-09T12:30:00.000Z'),
  (8, 5, 1, '2026-08-10T13:00:00.000Z', '2026-08-10T14:15:00.000Z'),
  (9, 4, 1, '2026-06-29T20:36:43.578Z', '2026-06-29T20:51:43.578Z'),
  (10, 5, 25, '2026-07-09T19:12:36.181Z', '2026-07-09T19:27:36.181Z'),
  (11, 18, 31, '2026-08-04T18:47:38.499Z', '2026-08-04T18:49:38.499Z'),
  (12, 18, 32, '2026-08-13T03:28:35.260Z', '2026-08-13T03:30:35.260Z'),
  (13, 18, 10, '2026-08-14T06:57:13.313Z', '2026-08-14T06:58:13.313Z'),
  (14, 18, 12, '2026-08-14T06:58:46.982Z', '2026-08-14T06:59:46.982Z'),
  (15, 18, 11, '2026-08-14T06:58:47.478Z', '2026-08-14T06:59:47.478Z'),
  (16, 18, 13, '2026-08-14T06:58:49.080Z', '2026-08-14T06:59:49.080Z'),
  (17, 18, 14, '2026-08-14T06:58:52.439Z', '2026-08-14T06:59:52.439Z'),
  (18, 18, 33, '2026-08-14T07:12:49.630Z', '2026-08-14T07:13:49.630Z'),
  (19, 18, 1, '2026-08-14T23:07:53.436Z', '2026-08-14T23:10:52.408Z'),
  (20, 18, 33, '2026-08-14T23:46:01.478Z', '2026-08-14T23:47:43.478Z'),
  (21, 18, 30, '2026-08-14T23:59:49.167Z', '2026-08-14T23:59:53.167Z'),
  (22, 5, 27, '2026-08-15T00:46:21.467Z', '2026-08-15T00:46:24.467Z'),
  (23, 5, 30, '2026-08-15T01:07:55.582Z', '2026-08-15T01:09:04.582Z'),
  (24, 5, 30, '2026-08-15T01:16:49.235Z', '2026-08-15T01:17:00.235Z'),
  (25, 5, 27, '2026-08-15T03:57:28.469Z', '2026-08-15T03:58:18.469Z'),
  (26, 5, 27, '2026-08-15T04:03:24.693Z', '2026-08-15T04:03:39.693Z'),
  (27, 5, 27, '2026-08-15T04:14:51.820Z', '2026-08-15T04:15:30.820Z'),
  (28, 5, 27, '2026-08-15T05:02:11.775Z', '2026-08-15T05:02:45.775Z'),
  (29, 5, 27, '2026-08-15T05:34:53.323Z', '2026-08-15T05:35:16.323Z'),
  (30, 4, 25, '2026-08-15T23:03:53.067Z', '2026-08-15T23:04:39.067Z'),
  (31, 4, 25, '2026-08-15T23:53:34.688Z', '2026-08-15T23:53:41.688Z'),
  (32, 5, 27, '2026-08-16T04:38:28.932Z', '2026-08-16T04:38:38.932Z'),
  (33, 5, 18, '2026-08-16T05:16:47.516Z', '2026-08-16T05:18:38.516Z'),
  (34, 5, 18, '2026-08-16T05:23:16.266Z', '2026-08-16T05:24:01.266Z'),
  (35, 31, 34, '2026-08-16T19:40:26.532Z', '2026-08-16T19:40:49.532Z'),
  (36, 5, 36, '2026-08-16T19:40:18.185Z', '2026-08-16T19:40:48.185Z'),
  (37, 5, 34, '2026-08-17T00:04:09.358Z', '2026-08-17T00:05:49.358Z'),
  (38, 5, 34, '2026-08-17T00:15:00.506Z', '2026-08-17T00:15:40.506Z'),
  (39, 5, 34, '2026-08-17T00:19:02.100Z', '2026-08-17T00:19:16.100Z'),
  (40, 5, 35, '2026-08-17T00:27:23.238Z', '2026-08-17T00:27:40.238Z'),
  (41, 5, 34, '2026-08-17T00:52:03.230Z', '2026-08-17T00:52:24.230Z'),
  (42, 5, 34, '2026-08-17T00:56:53.885Z', '2026-08-17T00:57:06.885Z'),
  (43, 5, 35, '2026-08-17T01:00:11.495Z', '2026-08-17T01:04:18.495Z'),
  (44, 5, 35, '2026-08-17T01:07:42.518Z', '2026-08-17T01:09:27.518Z'),
  (45, 4, 32, '2026-08-17T02:06:56.196Z', '2026-08-17T02:08:48.196Z'),
  (46, 4, 32, '2026-08-17T02:19:28.698Z', '2026-08-17T02:19:39.698Z'),
  (47, 4, 25, '2026-08-18T01:35:41.863Z', '2026-08-18T01:35:54.863Z'),
  (48, 4, 27, '2026-08-18T01:49:10.670Z', '2026-08-18T01:50:22.670Z'),
  (49, 5, 43, '2026-08-18T18:28:33.742Z', '2026-08-18T18:28:40.742Z'),
  (50, 5, 44, '2026-08-18T20:10:12.489Z', '2026-08-18T20:10:20.489Z'),
  (51, 5, 44, '2026-08-18T21:15:13.897Z', '2026-08-18T21:16:27.897Z'),
  (52, 5, 44, '2026-08-18T21:26:05.425Z', '2026-08-18T21:26:18.425Z'),
  (53, 5, 44, '2026-08-19T00:01:07.776Z', '2026-08-19T00:02:52.776Z'),
  (54, 5, 21, '2026-08-19T03:42:04.880Z', '2026-08-19T03:43:50.880Z'),
  (55, 5, 29, '2026-08-19T03:58:05.476Z', '2026-08-19T03:58:40.476Z'),
  (56, 5, 29, '2026-08-19T04:01:14.634Z', '2026-08-19T04:01:44.634Z'),
  (57, 4, 32, '2026-08-19T05:10:30.724Z', '2026-08-19T05:11:03.724Z'),
  (58, 4, 18, '2026-08-19T06:09:31.387Z', '2026-08-19T06:11:27.387Z'),
  (59, 4, 44, '2026-08-19T06:26:01.209Z', '2026-08-19T06:27:34.209Z'),
  (60, 4, 44, '2026-08-19T07:34:29.463Z', '2026-08-19T07:35:18.463Z'),
  (61, 5, 44, '2026-08-19T07:49:15.536Z', '2026-08-19T07:49:45.536Z'),
  (62, 31, 32, '2026-08-19T09:09:03.848Z', '2026-08-19T09:09:17.848Z'),
  (63, 5, 44, '2026-08-19T18:03:47.049Z', '2026-08-19T18:03:57.049Z'),
  (64, 5, 1, '2026-08-19T23:56:06.599Z', '2026-08-19T23:57:42.599Z'),
  (65, 5, 44, '2026-08-20T01:15:42.681Z', '2026-08-20T01:16:14.681Z'),
  (66, 5, 45, '2026-08-20T05:30:42.944Z', '2026-08-20T05:31:11.944Z'),
  (67, 5, 41, '2026-08-20T05:34:18.968Z', '2026-08-20T05:35:04.968Z'),
  (68, 5, 45, '2026-08-20T05:38:12.777Z', '2026-08-20T05:38:17.777Z'),
  (69, 5, 44, '2026-08-20T06:13:31.532Z', '2026-08-20T06:13:38.532Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"learning_ss"', 'learning_ss_id'), coalesce(max("learning_ss_id"), 1), max("learning_ss_id") IS NOT NULL) FROM "learning_ss";

-- Dữ liệu bảng lesson_subtitles (30 records)
INSERT INTO "lesson_subtitles" ("subtitle_id", "lesson_id", "en_vtt", "vi_vtt", "bilingual_vtt", "cues", "created_at", "updated_at", "is_auto_generated_fallback")
VALUES
  (1, 1, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to 1. Chào mừng bạn đến với khóa học.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học 1. Chào mừng bạn đến với khóa học.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to 1. Chào mừng bạn đến với khóa học.
Chào mừng tất cả các bạn đến với bài học 1. Chào mừng bạn đến với khóa học.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to 1. Chào mừng bạn đến với khóa học.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học 1. Chào mừng bạn đến với khóa học.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:46:25.758Z', '2026-08-15T03:46:25.758Z', FALSE),
  (2, 10, 'WEBVTT

1
00:00:00.000 --> 00:00:03.500
Hello and welcome to English for Complete Beginners!

2
00:00:03.800 --> 00:00:08.000
In this lesson, you will learn how to greet people and introduce yourself with confidence.

3
00:00:08.300 --> 00:00:13.000
Common greetings include: ''Hello'', ''Good morning'', ''Good afternoon'', and ''How are you?''.

4
00:00:13.300 --> 00:00:18.500
To introduce yourself, simply say: ''My name is...'' or ''I am from...''.

5
00:00:18.800 --> 00:00:24.000
Let''s practice pronouncing each phrase together step by step!

', 'WEBVTT

1
00:00:00.000 --> 00:00:03.500
Xin chào và chào mừng bạn đến với khóa học Tiếng Anh cho người mới bắt đầu!

2
00:00:03.800 --> 00:00:08.000
Trong bài học này, bạn sẽ học cách chào hỏi và tự giới thiệu bản thân một cách tự tin.

3
00:00:08.300 --> 00:00:13.000
Các câu chào phổ biến gồm: ''Hello'', ''Good morning'', ''Good afternoon'', và ''How are you?''.

4
00:00:13.300 --> 00:00:18.500
Để tự giới thiệu, bạn chỉ cần nói: ''My name is...'' (Tên tôi là...) hoặc ''I am from...'' (Tôi đến từ...).

5
00:00:18.800 --> 00:00:24.000
Hãy cùng luyện phát âm từng cụm từ theo hướng dẫn từng bước nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:03.500
Hello and welcome to English for Complete Beginners!
Xin chào và chào mừng bạn đến với khóa học Tiếng Anh cho người mới bắt đầu!

2
00:00:03.800 --> 00:00:08.000
In this lesson, you will learn how to greet people and introduce yourself with confidence.
Trong bài học này, bạn sẽ học cách chào hỏi và tự giới thiệu bản thân một cách tự tin.

3
00:00:08.300 --> 00:00:13.000
Common greetings include: ''Hello'', ''Good morning'', ''Good afternoon'', and ''How are you?''.
Các câu chào phổ biến gồm: ''Hello'', ''Good morning'', ''Good afternoon'', và ''How are you?''.

4
00:00:13.300 --> 00:00:18.500
To introduce yourself, simply say: ''My name is...'' or ''I am from...''.
Để tự giới thiệu, bạn chỉ cần nói: ''My name is...'' (Tên tôi là...) hoặc ''I am from...'' (Tôi đến từ...).

5
00:00:18.800 --> 00:00:24.000
Let''s practice pronouncing each phrase together step by step!
Hãy cùng luyện phát âm từng cụm từ theo hướng dẫn từng bước nhé!

', '[{"en":"Hello and welcome to English for Complete Beginners!","id":1,"vi":"Xin chào và chào mừng bạn đến với khóa học Tiếng Anh cho người mới bắt đầu!","end":3.5,"start":0,"endFormatted":"00:00:03.500","startFormatted":"00:00:00.000"},{"en":"In this lesson, you will learn how to greet people and introduce yourself with confidence.","id":2,"vi":"Trong bài học này, bạn sẽ học cách chào hỏi và tự giới thiệu bản thân một cách tự tin.","end":8,"start":3.8,"endFormatted":"00:00:08.000","startFormatted":"00:00:03.800"},{"en":"Common greetings include: ''Hello'', ''Good morning'', ''Good afternoon'', and ''How are you?''.","id":3,"vi":"Các câu chào phổ biến gồm: ''Hello'', ''Good morning'', ''Good afternoon'', và ''How are you?''.","end":13,"start":8.3,"endFormatted":"00:00:13.000","startFormatted":"00:00:08.300"},{"en":"To introduce yourself, simply say: ''My name is...'' or ''I am from...''.","id":4,"vi":"Để tự giới thiệu, bạn chỉ cần nói: ''My name is...'' (Tên tôi là...) hoặc ''I am from...'' (Tôi đến từ...).","end":18.5,"start":13.3,"endFormatted":"00:00:18.500","startFormatted":"00:00:13.300"},{"en":"Let''s practice pronouncing each phrase together step by step!","id":5,"vi":"Hãy cùng luyện phát âm từng cụm từ theo hướng dẫn từng bước nhé!","end":24,"start":18.8,"endFormatted":"00:00:24.000","startFormatted":"00:00:18.800"}]', '2026-08-15T03:46:34.646Z', '2026-08-15T03:59:27.032Z', FALSE),
  (3, 11, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', '[{"en":"Hello everyone! Welcome back to our English Grammar lesson.","id":1,"vi":"Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Today, we are learning about Subject Pronouns and Object Pronouns in English.","id":2,"vi":"Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Look at the key example on the screen: I see them.","id":3,"vi":"Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).","end":14,"start":8.8,"endFormatted":"00:00:14.000","startFormatted":"00:00:08.800"},{"en":"In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.","id":4,"vi":"Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.","end":19.5,"start":14.3,"endFormatted":"00:00:19.500","startFormatted":"00:00:14.300"},{"en":"Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.","id":5,"vi":"Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.","end":25.5,"start":19.8,"endFormatted":"00:00:25.500","startFormatted":"00:00:19.800"},{"en":"Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.","id":6,"vi":"Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.","end":31.5,"start":25.8,"endFormatted":"00:00:31.500","startFormatted":"00:00:25.800"},{"en":"For instance: They see me, She helps him, and We listen to them carefully.","id":7,"vi":"Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).","end":37.5,"start":31.8,"endFormatted":"00:00:37.500","startFormatted":"00:00:31.800"},{"en":"Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.","id":8,"vi":"Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.","end":44,"start":37.8,"endFormatted":"00:00:44.000","startFormatted":"00:00:37.800"},{"en":"Now, let''s practice speaking and making sentences with Subject and Object pronouns together!","id":9,"vi":"Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!","end":50,"start":44.3,"endFormatted":"00:00:50.000","startFormatted":"00:00:44.300"}]', '2026-08-15T03:46:44.477Z', '2026-08-15T03:59:27.181Z', FALSE),
  (4, 12, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', '[{"en":"Hello everyone! Welcome back to our English Grammar lesson.","id":1,"vi":"Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Today, we are learning about Subject Pronouns and Object Pronouns in English.","id":2,"vi":"Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Look at the key example on the screen: I see them.","id":3,"vi":"Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).","end":14,"start":8.8,"endFormatted":"00:00:14.000","startFormatted":"00:00:08.800"},{"en":"In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.","id":4,"vi":"Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.","end":19.5,"start":14.3,"endFormatted":"00:00:19.500","startFormatted":"00:00:14.300"},{"en":"Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.","id":5,"vi":"Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.","end":25.5,"start":19.8,"endFormatted":"00:00:25.500","startFormatted":"00:00:19.800"},{"en":"Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.","id":6,"vi":"Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.","end":31.5,"start":25.8,"endFormatted":"00:00:31.500","startFormatted":"00:00:25.800"},{"en":"For instance: They see me, She helps him, and We listen to them carefully.","id":7,"vi":"Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).","end":37.5,"start":31.8,"endFormatted":"00:00:37.500","startFormatted":"00:00:31.800"},{"en":"Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.","id":8,"vi":"Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.","end":44,"start":37.8,"endFormatted":"00:00:44.000","startFormatted":"00:00:37.800"},{"en":"Now, let''s practice speaking and making sentences with Subject and Object pronouns together!","id":9,"vi":"Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!","end":50,"start":44.3,"endFormatted":"00:00:50.000","startFormatted":"00:00:44.300"}]', '2026-08-15T03:46:53.677Z', '2026-08-15T03:59:27.320Z', FALSE),
  (5, 13, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:47:03.333Z', '2026-08-15T05:07:23.752Z', FALSE),
  (6, 14, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Today, we are exploring the Present Continuous Tense.

2
00:00:04.200 --> 00:00:09.500
We use the Present Continuous to talk about actions happening right now at the moment of speaking.

3
00:00:09.800 --> 00:00:15.500
The basic formula is: Subject + am / is / are + Verb-ing.

4
00:00:15.800 --> 00:00:21.500
For example: I am studying English right now, and she is reading a book.

5
00:00:21.800 --> 00:00:28.000
Look for signal words like ''now'', ''at the moment'', or ''currently'' in your tests.

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào tất cả các bạn! Hôm nay, chúng ta sẽ cùng khám phá Thì Hiện tại Tiếp diễn.

2
00:00:04.200 --> 00:00:09.500
Chúng ta sử dụng Thì Hiện tại Tiếp diễn để diễn tả các hành động đang diễn ra ngay tại thời điểm nói.

3
00:00:09.800 --> 00:00:15.500
Cấu trúc cơ bản là: Chủ ngữ + am / is / are + Động từ đuôi -ing.

4
00:00:15.800 --> 00:00:21.500
Ví dụ: I am studying English (Tôi đang học tiếng Anh), và she is reading a book (cô ấy đang đọc sách).

5
00:00:21.800 --> 00:00:28.000
Hãy chú ý các dấu hiệu nhận biết như ''now'', ''at the moment'', hoặc ''currently'' trong các bài thi nhé.

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Today, we are exploring the Present Continuous Tense.
Xin chào tất cả các bạn! Hôm nay, chúng ta sẽ cùng khám phá Thì Hiện tại Tiếp diễn.

2
00:00:04.200 --> 00:00:09.500
We use the Present Continuous to talk about actions happening right now at the moment of speaking.
Chúng ta sử dụng Thì Hiện tại Tiếp diễn để diễn tả các hành động đang diễn ra ngay tại thời điểm nói.

3
00:00:09.800 --> 00:00:15.500
The basic formula is: Subject + am / is / are + Verb-ing.
Cấu trúc cơ bản là: Chủ ngữ + am / is / are + Động từ đuôi -ing.

4
00:00:15.800 --> 00:00:21.500
For example: I am studying English right now, and she is reading a book.
Ví dụ: I am studying English (Tôi đang học tiếng Anh), và she is reading a book (cô ấy đang đọc sách).

5
00:00:21.800 --> 00:00:28.000
Look for signal words like ''now'', ''at the moment'', or ''currently'' in your tests.
Hãy chú ý các dấu hiệu nhận biết như ''now'', ''at the moment'', hoặc ''currently'' trong các bài thi nhé.

', '[{"en":"Hello everyone! Today, we are exploring the Present Continuous Tense.","id":1,"vi":"Xin chào tất cả các bạn! Hôm nay, chúng ta sẽ cùng khám phá Thì Hiện tại Tiếp diễn.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"We use the Present Continuous to talk about actions happening right now at the moment of speaking.","id":2,"vi":"Chúng ta sử dụng Thì Hiện tại Tiếp diễn để diễn tả các hành động đang diễn ra ngay tại thời điểm nói.","end":9.5,"start":4.2,"endFormatted":"00:00:09.500","startFormatted":"00:00:04.200"},{"en":"The basic formula is: Subject + am / is / are + Verb-ing.","id":3,"vi":"Cấu trúc cơ bản là: Chủ ngữ + am / is / are + Động từ đuôi -ing.","end":15.5,"start":9.8,"endFormatted":"00:00:15.500","startFormatted":"00:00:09.800"},{"en":"For example: I am studying English right now, and she is reading a book.","id":4,"vi":"Ví dụ: I am studying English (Tôi đang học tiếng Anh), và she is reading a book (cô ấy đang đọc sách).","end":21.5,"start":15.8,"endFormatted":"00:00:21.500","startFormatted":"00:00:15.800"},{"en":"Look for signal words like ''now'', ''at the moment'', or ''currently'' in your tests.","id":5,"vi":"Hãy chú ý các dấu hiệu nhận biết như ''now'', ''at the moment'', hoặc ''currently'' trong các bài thi nhé.","end":28,"start":21.8,"endFormatted":"00:00:28.000","startFormatted":"00:00:21.800"}]', '2026-08-15T03:47:12.320Z', '2026-08-15T03:59:27.598Z', FALSE),
  (7, 16, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:47:21.638Z', '2026-08-15T05:07:23.575Z', FALSE),
  (8, 17, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:47:31.225Z', '2026-08-15T03:47:31.225Z', FALSE),
  (9, 18, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Today, we are exploring the Present Continuous Tense.

2
00:00:04.200 --> 00:00:09.500
We use the Present Continuous to talk about actions happening right now at the moment of speaking.

3
00:00:09.800 --> 00:00:15.500
The basic formula is: Subject + am / is / are + Verb-ing.

4
00:00:15.800 --> 00:00:21.500
For example: I am studying English right now, and she is reading a book.

5
00:00:21.800 --> 00:00:28.000
Look for signal words like ''now'', ''at the moment'', or ''currently'' in your tests.

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào tất cả các bạn! Hôm nay, chúng ta sẽ cùng khám phá Thì Hiện tại Tiếp diễn.

2
00:00:04.200 --> 00:00:09.500
Chúng ta sử dụng Thì Hiện tại Tiếp diễn để diễn tả các hành động đang diễn ra ngay tại thời điểm nói.

3
00:00:09.800 --> 00:00:15.500
Cấu trúc cơ bản là: Chủ ngữ + am / is / are + Động từ đuôi -ing.

4
00:00:15.800 --> 00:00:21.500
Ví dụ: I am studying English (Tôi đang học tiếng Anh), và she is reading a book (cô ấy đang đọc sách).

5
00:00:21.800 --> 00:00:28.000
Hãy chú ý các dấu hiệu nhận biết như ''now'', ''at the moment'', hoặc ''currently'' trong các bài thi nhé.

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Today, we are exploring the Present Continuous Tense.
Xin chào tất cả các bạn! Hôm nay, chúng ta sẽ cùng khám phá Thì Hiện tại Tiếp diễn.

2
00:00:04.200 --> 00:00:09.500
We use the Present Continuous to talk about actions happening right now at the moment of speaking.
Chúng ta sử dụng Thì Hiện tại Tiếp diễn để diễn tả các hành động đang diễn ra ngay tại thời điểm nói.

3
00:00:09.800 --> 00:00:15.500
The basic formula is: Subject + am / is / are + Verb-ing.
Cấu trúc cơ bản là: Chủ ngữ + am / is / are + Động từ đuôi -ing.

4
00:00:15.800 --> 00:00:21.500
For example: I am studying English right now, and she is reading a book.
Ví dụ: I am studying English (Tôi đang học tiếng Anh), và she is reading a book (cô ấy đang đọc sách).

5
00:00:21.800 --> 00:00:28.000
Look for signal words like ''now'', ''at the moment'', or ''currently'' in your tests.
Hãy chú ý các dấu hiệu nhận biết như ''now'', ''at the moment'', hoặc ''currently'' trong các bài thi nhé.

', '[{"en":"Hello everyone! Today, we are exploring the Present Continuous Tense.","id":1,"vi":"Xin chào tất cả các bạn! Hôm nay, chúng ta sẽ cùng khám phá Thì Hiện tại Tiếp diễn.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"We use the Present Continuous to talk about actions happening right now at the moment of speaking.","id":2,"vi":"Chúng ta sử dụng Thì Hiện tại Tiếp diễn để diễn tả các hành động đang diễn ra ngay tại thời điểm nói.","end":9.5,"start":4.2,"endFormatted":"00:00:09.500","startFormatted":"00:00:04.200"},{"en":"The basic formula is: Subject + am / is / are + Verb-ing.","id":3,"vi":"Cấu trúc cơ bản là: Chủ ngữ + am / is / are + Động từ đuôi -ing.","end":15.5,"start":9.8,"endFormatted":"00:00:15.500","startFormatted":"00:00:09.800"},{"en":"For example: I am studying English right now, and she is reading a book.","id":4,"vi":"Ví dụ: I am studying English (Tôi đang học tiếng Anh), và she is reading a book (cô ấy đang đọc sách).","end":21.5,"start":15.8,"endFormatted":"00:00:21.500","startFormatted":"00:00:15.800"},{"en":"Look for signal words like ''now'', ''at the moment'', or ''currently'' in your tests.","id":5,"vi":"Hãy chú ý các dấu hiệu nhận biết như ''now'', ''at the moment'', hoặc ''currently'' trong các bài thi nhé.","end":28,"start":21.8,"endFormatted":"00:00:28.000","startFormatted":"00:00:21.800"}]', '2026-08-15T03:47:40.943Z', '2026-08-15T03:59:27.870Z', FALSE),
  (10, 19, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:47:51.873Z', '2026-08-15T03:47:51.873Z', FALSE),
  (11, 20, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:48:01.985Z', '2026-08-15T03:48:01.985Z', FALSE),
  (12, 21, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:48:11.302Z', '2026-08-15T05:07:23.398Z', FALSE),
  (13, 22, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:48:20.828Z', '2026-08-15T03:48:20.828Z', FALSE),
  (14, 25, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:48:30.459Z', '2026-08-15T05:07:23.222Z', FALSE),
  (15, 26, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:48:50.597Z', '2026-08-15T03:48:50.597Z', FALSE),
  (16, 27, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:49:02.279Z', '2026-08-15T05:07:22.866Z', FALSE),
  (17, 28, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Welcome back! In this section, we will study Possessive Adjectives and Possessive Pronouns.

2
00:00:04.200 --> 00:00:09.000
Possessive adjectives describe ownership and are always followed by a noun: my book, your car.

3
00:00:09.300 --> 00:00:15.000
On the other hand, possessive pronouns replace both the adjective and noun: This book is mine.

4
00:00:15.300 --> 00:00:21.000
Let''s review the pairs: my - mine, your - yours, our - ours, their - theirs, his - his, her - hers.

5
00:00:21.300 --> 00:00:28.000
Practice reading aloud these sentences to build natural English speaking reflexes!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng các bạn quay trở lại! Trong phần này, chúng ta sẽ học về Tính từ sở hữu và Đại từ sở hữu.

2
00:00:04.200 --> 00:00:09.000
Tính từ sở hữu diễn tả quyền sở hữu và luôn đi kèm danh từ theo sau: my book (sách của tôi), your car (xe của bạn).

3
00:00:09.300 --> 00:00:15.000
Mặt khác, đại từ sở hữu thay thế cho cả cụm tính từ và danh từ: Cuốn sách này là của tôi (This book is mine).

4
00:00:15.300 --> 00:00:21.000
Hãy cùng ôn lại các cặp từ: my - mine, your - yours, our - ours, their - theirs, his - his, her - hers.

5
00:00:21.300 --> 00:00:28.000
Hãy luyện đọc to các câu này để hình thành phản xạ nói tiếng Anh tự nhiên nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Welcome back! In this section, we will study Possessive Adjectives and Possessive Pronouns.
Chào mừng các bạn quay trở lại! Trong phần này, chúng ta sẽ học về Tính từ sở hữu và Đại từ sở hữu.

2
00:00:04.200 --> 00:00:09.000
Possessive adjectives describe ownership and are always followed by a noun: my book, your car.
Tính từ sở hữu diễn tả quyền sở hữu và luôn đi kèm danh từ theo sau: my book (sách của tôi), your car (xe của bạn).

3
00:00:09.300 --> 00:00:15.000
On the other hand, possessive pronouns replace both the adjective and noun: This book is mine.
Mặt khác, đại từ sở hữu thay thế cho cả cụm tính từ và danh từ: Cuốn sách này là của tôi (This book is mine).

4
00:00:15.300 --> 00:00:21.000
Let''s review the pairs: my - mine, your - yours, our - ours, their - theirs, his - his, her - hers.
Hãy cùng ôn lại các cặp từ: my - mine, your - yours, our - ours, their - theirs, his - his, her - hers.

5
00:00:21.300 --> 00:00:28.000
Practice reading aloud these sentences to build natural English speaking reflexes!
Hãy luyện đọc to các câu này để hình thành phản xạ nói tiếng Anh tự nhiên nhé!

', '[{"en":"Welcome back! In this section, we will study Possessive Adjectives and Possessive Pronouns.","id":1,"vi":"Chào mừng các bạn quay trở lại! Trong phần này, chúng ta sẽ học về Tính từ sở hữu và Đại từ sở hữu.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Possessive adjectives describe ownership and are always followed by a noun: my book, your car.","id":2,"vi":"Tính từ sở hữu diễn tả quyền sở hữu và luôn đi kèm danh từ theo sau: my book (sách của tôi), your car (xe của bạn).","end":9,"start":4.2,"endFormatted":"00:00:09.000","startFormatted":"00:00:04.200"},{"en":"On the other hand, possessive pronouns replace both the adjective and noun: This book is mine.","id":3,"vi":"Mặt khác, đại từ sở hữu thay thế cho cả cụm tính từ và danh từ: Cuốn sách này là của tôi (This book is mine).","end":15,"start":9.3,"endFormatted":"00:00:15.000","startFormatted":"00:00:09.300"},{"en":"Let''s review the pairs: my - mine, your - yours, our - ours, their - theirs, his - his, her - hers.","id":4,"vi":"Hãy cùng ôn lại các cặp từ: my - mine, your - yours, our - ours, their - theirs, his - his, her - hers.","end":21,"start":15.3,"endFormatted":"00:00:21.000","startFormatted":"00:00:15.300"},{"en":"Practice reading aloud these sentences to build natural English speaking reflexes!","id":5,"vi":"Hãy luyện đọc to các câu này để hình thành phản xạ nói tiếng Anh tự nhiên nhé!","end":28,"start":21.3,"endFormatted":"00:00:28.000","startFormatted":"00:00:21.300"}]', '2026-08-15T03:49:11.905Z', '2026-08-15T03:59:28.416Z', FALSE),
  (18, 29, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:49:12.274Z', '2026-08-15T03:49:12.274Z', FALSE),
  (19, 30, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:49:13.128Z', '2026-08-15T05:07:23.929Z', FALSE),
  (20, 31, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to 1. Chào mừng bạn đến với khóa học.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.000
How are you today

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học 1. Chào mừng bạn đến với khóa học.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.000
Luyện tập phát âm: How are you today

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to 1. Chào mừng bạn đến với khóa học.
Chào mừng tất cả các bạn đến với bài học 1. Chào mừng bạn đến với khóa học.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.000
How are you today
Luyện tập phát âm: How are you today

', '[{"en":"Hello everyone! Welcome to 1. Chào mừng bạn đến với khóa học.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học 1. Chào mừng bạn đến với khóa học.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"How are you today","id":3,"vi":"Luyện tập phát âm: How are you today","end":13,"start":9,"endFormatted":"00:00:13.000","startFormatted":"00:00:09.000"}]', '2026-08-15T03:49:13.511Z', '2026-08-15T03:49:13.511Z', FALSE),
  (21, 32, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:49:13.881Z', '2026-08-15T03:49:13.881Z', FALSE),
  (22, 33, 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.

2
00:04.500 --> 00:09.000
They know me.

3
00:09.300 --> 00:14.500
We like you.

4
00:14.800 --> 00:19.500
You help us.

5
00:19.800 --> 00:25.000
He calls her.

6
00:25.300 --> 00:30.500
She loves him.

7
00:30.800 --> 00:36.500
It belongs to them.

8
00:36.799 --> 00:42.500
They need it.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.

52
06:11.500 --> 06:17.000
I see them. They know me.

53
06:17.500 --> 06:23.000
We like you. You help us.

54
06:23.500 --> 06:29.000
He calls her. She loves him.

55
06:29.500 --> 06:36.000
It belongs to them. They need it.

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!

', 'WEBVTT

1
00:00.000 --> 00:04.200
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
Họ biết tôi.

3
00:09.300 --> 00:14.500
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
Họ cần nó.

9
00:43.000 --> 00:49.000
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Chúc các bạn học tập thật tốt!

', 'WEBVTT

1
00:00.000 --> 00:04.200
I see them.
Tôi nhìn thấy họ.

2
00:04.500 --> 00:09.000
They know me.
Họ biết tôi.

3
00:09.300 --> 00:14.500
We like you.
Chúng tôi quý bạn.

4
00:14.800 --> 00:19.500
You help us.
Bạn giúp chúng tôi.

5
00:19.800 --> 00:25.000
He calls her.
Anh ấy gọi điện cho cô ấy.

6
00:25.300 --> 00:30.500
She loves him.
Cô ấy yêu anh ấy.

7
00:30.800 --> 00:36.500
It belongs to them.
Nó thuộc về họ.

8
00:36.799 --> 00:42.500
They need it.
Họ cần nó.

9
00:43.000 --> 00:49.000
Now, let''s understand why we use these different forms in English.
Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.

10
00:49.500 --> 00:55.500
First, Subject Pronouns: I, You, We, They, He, She, It.
Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.

11
00:56.000 --> 01:02.000
Subject pronouns always perform the action and stand before the verb.
Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.

12
01:02.500 --> 01:09.000
For example: I see them. ''I'' is the subject doing the action of seeing.
Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.

13
01:09.500 --> 01:16.000
Another example: She loves him. ''She'' is the subject before the verb ''loves''.
Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.

14
01:16.500 --> 01:24.000
Remember: Whenever a pronoun is before the main verb, use the Subject form!
Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!

15
01:24.500 --> 01:32.000
We say: They know me, NOT Them know me.
Chúng ta nói: They know me, chứ KHÔNG nói Them know me.

16
01:32.500 --> 01:39.000
Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.
Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.

17
01:39.500 --> 01:46.000
Object pronouns receive the action and stand after verbs or prepositions.
Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.

18
01:46.500 --> 01:54.000
In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.
Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.

19
01:54.500 --> 02:02.000
In ''You help us'', ''us'' is the object receiving the help from ''You''.
Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.

20
02:02.500 --> 02:10.000
Notice that ''You'' and ''It'' have the same form for both subject and object!
Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!

21
02:10.500 --> 02:18.000
You see me (Subject), and I see you (Object).
You see me (You là chủ ngữ), và I see you (you là tân ngữ).

22
02:18.500 --> 02:26.000
A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.
Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.

23
02:26.500 --> 02:33.000
Listen to me! We use ''me'', not ''I''.
Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.

24
02:33.500 --> 02:40.000
Look at him! We use ''him'', not ''he''.
Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.

25
02:40.500 --> 02:47.000
She is waiting for us. We use ''us'' after the preposition ''for''.
Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.

26
02:47.500 --> 02:55.000
He wants to speak with them. We use ''them'' after ''with''.
Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.

27
02:55.500 --> 03:03.000
This gift is for her. Never say ''for she''!
Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!

28
03:03.500 --> 03:11.000
Let''s compare these sentence pairs to see the difference clearly.
Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.

29
03:11.500 --> 03:18.000
He loves her, and she loves him.
Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).

30
03:18.500 --> 03:26.000
Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.
Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.

31
03:26.500 --> 03:34.000
We invited them, and they invited us.
Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).

32
03:34.500 --> 03:42.000
I teach you English, and you practice English with me.
Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).

33
03:42.500 --> 03:50.000
Now, let''s review the most common mistakes English learners make.
Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.

34
03:50.500 --> 03:58.000
Mistake 1: Saying ''Me and him went to school''.
Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!

35
03:58.500 --> 04:06.000
Correction: ''He and I went to school'', because both are subjects before the verb!
Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!

36
04:06.500 --> 04:14.000
Mistake 2: Saying ''Between you and I''.
Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!

37
04:14.500 --> 04:22.000
Correction: ''Between you and me'', because ''between'' is a preposition!
Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!

38
04:22.500 --> 04:30.000
Always check the verb and preposition to choose the right pronoun!
Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!

39
04:30.500 --> 04:38.000
Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.
Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.

40
04:38.500 --> 04:46.000
Question 1: Peter called Sarah because he needed to ask (she / her) a question.
Câu 1: Peter called Sarah because he needed to ask (she / her) a question.

41
04:46.500 --> 04:54.000
The answer is: HER! Because it comes after the verb ''ask''.
Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.

42
04:54.500 --> 05:02.000
Question 2: (We / Us) are planning a surprise birthday party for our teacher.
Câu 2: (We / Us) are planning a surprise birthday party for our teacher.

43
05:02.500 --> 05:10.000
The answer is: WE! Because it is the subject before the verb ''are planning''.
Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.

44
05:10.500 --> 05:18.000
Question 3: Can you pass that book to (I / me), please?
Câu 3: Can you pass that book to (I / me), please?

45
05:18.500 --> 05:26.000
The answer is: ME! Because ''to'' is a preposition.
Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.

46
05:26.500 --> 05:34.000
Let''s summarize all Subject and Object Pronoun pairs on the board.
Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.

47
05:34.500 --> 05:41.000
I changes to ME. You stays as YOU.
I đổi thành ME. You giữ nguyên là YOU.

48
05:41.500 --> 05:48.000
We changes to US. They changes to THEM.
We đổi thành US. They đổi thành THEM.

49
05:48.500 --> 05:55.000
He changes to HIM. She changes to HER.
He đổi thành HIM. She đổi thành HER.

50
05:55.500 --> 06:03.000
It stays as IT. Make sure to take notes in your grammar notebook!
It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!

51
06:03.500 --> 06:11.000
Now, repeat after me to improve your pronunciation and natural speaking rhythm.
Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.

52
06:11.500 --> 06:17.000
I see them. They know me.
I see them. They know me. (Tôi thấy họ. Họ biết tôi.)

53
06:17.500 --> 06:23.000
We like you. You help us.
We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)

54
06:23.500 --> 06:29.000
He calls her. She loves him.
He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)

55
06:29.500 --> 06:36.000
It belongs to them. They need it.
It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)

56
06:36.500 --> 06:45.000
Excellent work! Your pronunciation is getting much more natural!
Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!

57
06:45.500 --> 06:52.000
For your homework, complete the practice quiz below this video lesson.
Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.

58
06:52.500 --> 06:59.000
Write 5 sentences using both Subject and Object pronouns in your notebook.
Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.

59
06:59.500 --> 07:07.000
In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!
Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!

60
07:07.500 --> 07:15.000
Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!
Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!

61
07:15.500 --> 07:19.800
E-Learn Academy - Happy learning!
E-Learn Academy - Chúc các bạn học tập thật tốt!

', '[{"en":"I see them.","id":1,"vi":"Tôi nhìn thấy họ.","end":4.2,"start":0,"endFormatted":"00:04.200","startFormatted":"00:00.000"},{"en":"They know me.","id":2,"vi":"Họ biết tôi.","end":9,"start":4.5,"endFormatted":"00:09.000","startFormatted":"00:04.500"},{"en":"We like you.","id":3,"vi":"Chúng tôi quý bạn.","end":14.5,"start":9.3,"endFormatted":"00:14.500","startFormatted":"00:09.300"},{"en":"You help us.","id":4,"vi":"Bạn giúp chúng tôi.","end":19.5,"start":14.8,"endFormatted":"00:19.500","startFormatted":"00:14.800"},{"en":"He calls her.","id":5,"vi":"Anh ấy gọi điện cho cô ấy.","end":25,"start":19.8,"endFormatted":"00:25.000","startFormatted":"00:19.800"},{"en":"She loves him.","id":6,"vi":"Cô ấy yêu anh ấy.","end":30.5,"start":25.3,"endFormatted":"00:30.500","startFormatted":"00:25.300"},{"en":"It belongs to them.","id":7,"vi":"Nó thuộc về họ.","end":36.5,"start":30.8,"endFormatted":"00:36.500","startFormatted":"00:30.800"},{"en":"They need it.","id":8,"vi":"Họ cần nó.","end":42.5,"start":36.8,"endFormatted":"00:42.500","startFormatted":"00:36.799"},{"en":"Now, let''s understand why we use these different forms in English.","id":9,"vi":"Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé.","end":49,"start":43,"endFormatted":"00:49.000","startFormatted":"00:43.000"},{"en":"First, Subject Pronouns: I, You, We, They, He, She, It.","id":10,"vi":"Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It.","end":55.5,"start":49.5,"endFormatted":"00:55.500","startFormatted":"00:49.500"},{"en":"Subject pronouns always perform the action and stand before the verb.","id":11,"vi":"Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ.","end":62,"start":56,"endFormatted":"01:02.000","startFormatted":"00:56.000"},{"en":"For example: I see them. ''I'' is the subject doing the action of seeing.","id":12,"vi":"Ví dụ: I see them. ''I'' là chủ ngữ thực hiện hành động nhìn thấy.","end":69,"start":62.5,"endFormatted":"01:09.000","startFormatted":"01:02.500"},{"en":"Another example: She loves him. ''She'' is the subject before the verb ''loves''.","id":13,"vi":"Một ví dụ khác: She loves him. ''She'' là chủ ngữ đứng trước động từ ''loves''.","end":76,"start":69.5,"endFormatted":"01:16.000","startFormatted":"01:09.500"},{"en":"Remember: Whenever a pronoun is before the main verb, use the Subject form!","id":14,"vi":"Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!","end":84,"start":76.5,"endFormatted":"01:24.000","startFormatted":"01:16.500"},{"en":"We say: They know me, NOT Them know me.","id":15,"vi":"Chúng ta nói: They know me, chứ KHÔNG nói Them know me.","end":92,"start":84.5,"endFormatted":"01:32.000","startFormatted":"01:24.500"},{"en":"Next, let''s look at Object Pronouns: Me, You, Us, Them, Him, Her, It.","id":16,"vi":"Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It.","end":99,"start":92.5,"endFormatted":"01:39.000","startFormatted":"01:32.500"},{"en":"Object pronouns receive the action and stand after verbs or prepositions.","id":17,"vi":"Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ.","end":106,"start":99.5,"endFormatted":"01:46.000","startFormatted":"01:39.500"},{"en":"In the sentence ''I see them'', ''them'' is the object pronoun after the verb ''see''.","id":18,"vi":"Trong câu ''I see them'', ''them'' là đại từ tân ngữ đứng sau động từ ''see''.","end":114,"start":106.5,"endFormatted":"01:54.000","startFormatted":"01:46.500"},{"en":"In ''You help us'', ''us'' is the object receiving the help from ''You''.","id":19,"vi":"Trong câu ''You help us'', ''us'' là tân ngữ nhận sự giúp đỡ từ chủ ngữ ''You''.","end":122,"start":114.5,"endFormatted":"02:02.000","startFormatted":"01:54.500"},{"en":"Notice that ''You'' and ''It'' have the same form for both subject and object!","id":20,"vi":"Hãy lưu ý rằng ''You'' và ''It'' có cùng dạng cho cả chủ ngữ và tân ngữ!","end":130,"start":122.5,"endFormatted":"02:10.000","startFormatted":"02:02.500"},{"en":"You see me (Subject), and I see you (Object).","id":21,"vi":"You see me (You là chủ ngữ), và I see you (you là tân ngữ).","end":138,"start":130.5,"endFormatted":"02:18.000","startFormatted":"02:10.500"},{"en":"A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.","id":22,"vi":"Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at.","end":146,"start":138.5,"endFormatted":"02:26.000","startFormatted":"02:18.500"},{"en":"Listen to me! We use ''me'', not ''I''.","id":23,"vi":"Hãy lắng nghe tôi: Listen to me! Chúng ta dùng ''me'', không dùng ''I''.","end":153,"start":146.5,"endFormatted":"02:33.000","startFormatted":"02:26.500"},{"en":"Look at him! We use ''him'', not ''he''.","id":24,"vi":"Hãy nhìn anh ấy: Look at him! Chúng ta dùng ''him'', không dùng ''he''.","end":160,"start":153.5,"endFormatted":"02:40.000","startFormatted":"02:33.500"},{"en":"She is waiting for us. We use ''us'' after the preposition ''for''.","id":25,"vi":"Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng ''us'' sau giới từ ''for''.","end":167,"start":160.5,"endFormatted":"02:47.000","startFormatted":"02:40.500"},{"en":"He wants to speak with them. We use ''them'' after ''with''.","id":26,"vi":"Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng ''them'' sau ''with''.","end":175,"start":167.5,"endFormatted":"02:55.000","startFormatted":"02:47.500"},{"en":"This gift is for her. Never say ''for she''!","id":27,"vi":"Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói ''for she''!","end":183,"start":175.5,"endFormatted":"03:03.000","startFormatted":"02:55.500"},{"en":"Let''s compare these sentence pairs to see the difference clearly.","id":28,"vi":"Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất.","end":191,"start":183.5,"endFormatted":"03:11.000","startFormatted":"03:03.500"},{"en":"He loves her, and she loves him.","id":29,"vi":"Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him).","end":198,"start":191.5,"endFormatted":"03:18.000","startFormatted":"03:11.500"},{"en":"Notice how ''He'' becomes ''him'', and ''She'' becomes ''her'' when their positions swap.","id":30,"vi":"Hãy để ý cách ''He'' chuyển thành ''him'', và ''She'' chuyển thành ''her'' khi đổi vị trí.","end":206,"start":198.5,"endFormatted":"03:26.000","startFormatted":"03:18.500"},{"en":"We invited them, and they invited us.","id":31,"vi":"Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us).","end":214,"start":206.5,"endFormatted":"03:34.000","startFormatted":"03:26.500"},{"en":"I teach you English, and you practice English with me.","id":32,"vi":"Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me).","end":222,"start":214.5,"endFormatted":"03:42.000","startFormatted":"03:34.500"},{"en":"Now, let''s review the most common mistakes English learners make.","id":33,"vi":"Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải.","end":230,"start":222.5,"endFormatted":"03:50.000","startFormatted":"03:42.500"},{"en":"Mistake 1: Saying ''Me and him went to school''.","id":34,"vi":"Lỗi 1: Nói ''Me and him went to school'' - Đây là câu sai ngữ pháp!","end":238,"start":230.5,"endFormatted":"03:58.000","startFormatted":"03:50.500"},{"en":"Correction: ''He and I went to school'', because both are subjects before the verb!","id":35,"vi":"Sửa lại đúng: ''He and I went to school'', vì cả hai đều là chủ ngữ đứng trước động từ!","end":246,"start":238.5,"endFormatted":"04:06.000","startFormatted":"03:58.500"},{"en":"Mistake 2: Saying ''Between you and I''.","id":36,"vi":"Lỗi 2: Nói ''Between you and I'' - Đây là lỗi rất nhiều người mắc!","end":254,"start":246.5,"endFormatted":"04:14.000","startFormatted":"04:06.500"},{"en":"Correction: ''Between you and me'', because ''between'' is a preposition!","id":37,"vi":"Sửa lại đúng: ''Between you and me'', vì ''between'' là một giới từ!","end":262,"start":254.5,"endFormatted":"04:22.000","startFormatted":"04:14.500"},{"en":"Always check the verb and preposition to choose the right pronoun!","id":38,"vi":"Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!","end":270,"start":262.5,"endFormatted":"04:30.000","startFormatted":"04:22.500"},{"en":"Let''s do a quick practice quiz together! Fill in the blanks with the correct pronoun.","id":39,"vi":"Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống.","end":278,"start":270.5,"endFormatted":"04:38.000","startFormatted":"04:30.500"},{"en":"Question 1: Peter called Sarah because he needed to ask (she / her) a question.","id":40,"vi":"Câu 1: Peter called Sarah because he needed to ask (she / her) a question.","end":286,"start":278.5,"endFormatted":"04:46.000","startFormatted":"04:38.500"},{"en":"The answer is: HER! Because it comes after the verb ''ask''.","id":41,"vi":"Đáp án là: HER! Vì đứng sau động từ ''ask'' cần dùng đại từ tân ngữ.","end":294,"start":286.5,"endFormatted":"04:54.000","startFormatted":"04:46.500"},{"en":"Question 2: (We / Us) are planning a surprise birthday party for our teacher.","id":42,"vi":"Câu 2: (We / Us) are planning a surprise birthday party for our teacher.","end":302,"start":294.5,"endFormatted":"05:02.000","startFormatted":"04:54.500"},{"en":"The answer is: WE! Because it is the subject before the verb ''are planning''.","id":43,"vi":"Đáp án là: WE! Vì là chủ ngữ đứng trước động từ ''are planning''.","end":310,"start":302.5,"endFormatted":"05:10.000","startFormatted":"05:02.500"},{"en":"Question 3: Can you pass that book to (I / me), please?","id":44,"vi":"Câu 3: Can you pass that book to (I / me), please?","end":318,"start":310.5,"endFormatted":"05:18.000","startFormatted":"05:10.500"},{"en":"The answer is: ME! Because ''to'' is a preposition.","id":45,"vi":"Đáp án là: ME! Vì ''to'' là giới từ nên bắt buộc dùng ''me''.","end":326,"start":318.5,"endFormatted":"05:26.000","startFormatted":"05:18.500"},{"en":"Let''s summarize all Subject and Object Pronoun pairs on the board.","id":46,"vi":"Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng.","end":334,"start":326.5,"endFormatted":"05:34.000","startFormatted":"05:26.500"},{"en":"I changes to ME. You stays as YOU.","id":47,"vi":"I đổi thành ME. You giữ nguyên là YOU.","end":341,"start":334.5,"endFormatted":"05:41.000","startFormatted":"05:34.500"},{"en":"We changes to US. They changes to THEM.","id":48,"vi":"We đổi thành US. They đổi thành THEM.","end":348,"start":341.5,"endFormatted":"05:48.000","startFormatted":"05:41.500"},{"en":"He changes to HIM. She changes to HER.","id":49,"vi":"He đổi thành HIM. She đổi thành HER.","end":355,"start":348.5,"endFormatted":"05:55.000","startFormatted":"05:48.500"},{"en":"It stays as IT. Make sure to take notes in your grammar notebook!","id":50,"vi":"It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!","end":363,"start":355.5,"endFormatted":"06:03.000","startFormatted":"05:55.500"},{"en":"Now, repeat after me to improve your pronunciation and natural speaking rhythm.","id":51,"vi":"Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé.","end":371,"start":363.5,"endFormatted":"06:11.000","startFormatted":"06:03.500"},{"en":"I see them. They know me.","id":52,"vi":"I see them. They know me. (Tôi thấy họ. Họ biết tôi.)","end":377,"start":371.5,"endFormatted":"06:17.000","startFormatted":"06:11.500"},{"en":"We like you. You help us.","id":53,"vi":"We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)","end":383,"start":377.5,"endFormatted":"06:23.000","startFormatted":"06:17.500"},{"en":"He calls her. She loves him.","id":54,"vi":"He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)","end":389,"start":383.5,"endFormatted":"06:29.000","startFormatted":"06:23.500"},{"en":"It belongs to them. They need it.","id":55,"vi":"It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)","end":396,"start":389.5,"endFormatted":"06:36.000","startFormatted":"06:29.500"},{"en":"Excellent work! Your pronunciation is getting much more natural!","id":56,"vi":"Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!","end":405,"start":396.5,"endFormatted":"06:45.000","startFormatted":"06:36.500"},{"en":"For your homework, complete the practice quiz below this video lesson.","id":57,"vi":"Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này.","end":412,"start":405.5,"endFormatted":"06:52.000","startFormatted":"06:45.500"},{"en":"Write 5 sentences using both Subject and Object pronouns in your notebook.","id":58,"vi":"Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn.","end":419,"start":412.5,"endFormatted":"06:59.000","startFormatted":"06:52.500"},{"en":"In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!","id":59,"vi":"Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!","end":427,"start":419.5,"endFormatted":"07:07.000","startFormatted":"06:59.500"},{"en":"Thank you for watching! Keep practicing, and I''ll see you in the next lesson. Goodbye!","id":60,"vi":"Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!","end":435,"start":427.5,"endFormatted":"07:15.000","startFormatted":"07:07.500"},{"en":"E-Learn Academy - Happy learning!","id":61,"vi":"E-Learn Academy - Chúc các bạn học tập thật tốt!","end":439.8,"start":435.5,"endFormatted":"07:19.800","startFormatted":"07:15.500"}]', '2026-08-15T03:49:14.633Z', '2026-08-15T05:07:24.106Z', FALSE),
  (23, 34, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:49:15.022Z', '2026-08-15T03:49:15.022Z', FALSE),
  (24, 35, 'WEBVTT

1
00:00:00.000 --> 00:00:03.500
Hello and welcome to English for Complete Beginners!

2
00:00:03.800 --> 00:00:08.000
In this lesson, you will learn how to greet people and introduce yourself with confidence.

3
00:00:08.300 --> 00:00:13.000
Common greetings include: ''Hello'', ''Good morning'', ''Good afternoon'', and ''How are you?''.

4
00:00:13.300 --> 00:00:18.500
To introduce yourself, simply say: ''My name is...'' or ''I am from...''.

5
00:00:18.800 --> 00:00:24.000
Let''s practice pronouncing each phrase together step by step!

', 'WEBVTT

1
00:00:00.000 --> 00:00:03.500
Xin chào và chào mừng bạn đến với khóa học Tiếng Anh cho người mới bắt đầu!

2
00:00:03.800 --> 00:00:08.000
Trong bài học này, bạn sẽ học cách chào hỏi và tự giới thiệu bản thân một cách tự tin.

3
00:00:08.300 --> 00:00:13.000
Các câu chào phổ biến gồm: ''Hello'', ''Good morning'', ''Good afternoon'', và ''How are you?''.

4
00:00:13.300 --> 00:00:18.500
Để tự giới thiệu, bạn chỉ cần nói: ''My name is...'' (Tên tôi là...) hoặc ''I am from...'' (Tôi đến từ...).

5
00:00:18.800 --> 00:00:24.000
Hãy cùng luyện phát âm từng cụm từ theo hướng dẫn từng bước nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:03.500
Hello and welcome to English for Complete Beginners!
Xin chào và chào mừng bạn đến với khóa học Tiếng Anh cho người mới bắt đầu!

2
00:00:03.800 --> 00:00:08.000
In this lesson, you will learn how to greet people and introduce yourself with confidence.
Trong bài học này, bạn sẽ học cách chào hỏi và tự giới thiệu bản thân một cách tự tin.

3
00:00:08.300 --> 00:00:13.000
Common greetings include: ''Hello'', ''Good morning'', ''Good afternoon'', and ''How are you?''.
Các câu chào phổ biến gồm: ''Hello'', ''Good morning'', ''Good afternoon'', và ''How are you?''.

4
00:00:13.300 --> 00:00:18.500
To introduce yourself, simply say: ''My name is...'' or ''I am from...''.
Để tự giới thiệu, bạn chỉ cần nói: ''My name is...'' (Tên tôi là...) hoặc ''I am from...'' (Tôi đến từ...).

5
00:00:18.800 --> 00:00:24.000
Let''s practice pronouncing each phrase together step by step!
Hãy cùng luyện phát âm từng cụm từ theo hướng dẫn từng bước nhé!

', '[{"en":"Hello and welcome to English for Complete Beginners!","id":1,"vi":"Xin chào và chào mừng bạn đến với khóa học Tiếng Anh cho người mới bắt đầu!","end":3.5,"start":0,"endFormatted":"00:00:03.500","startFormatted":"00:00:00.000"},{"en":"In this lesson, you will learn how to greet people and introduce yourself with confidence.","id":2,"vi":"Trong bài học này, bạn sẽ học cách chào hỏi và tự giới thiệu bản thân một cách tự tin.","end":8,"start":3.8,"endFormatted":"00:00:08.000","startFormatted":"00:00:03.800"},{"en":"Common greetings include: ''Hello'', ''Good morning'', ''Good afternoon'', and ''How are you?''.","id":3,"vi":"Các câu chào phổ biến gồm: ''Hello'', ''Good morning'', ''Good afternoon'', và ''How are you?''.","end":13,"start":8.3,"endFormatted":"00:00:13.000","startFormatted":"00:00:08.300"},{"en":"To introduce yourself, simply say: ''My name is...'' or ''I am from...''.","id":4,"vi":"Để tự giới thiệu, bạn chỉ cần nói: ''My name is...'' (Tên tôi là...) hoặc ''I am from...'' (Tôi đến từ...).","end":18.5,"start":13.3,"endFormatted":"00:00:18.500","startFormatted":"00:00:13.300"},{"en":"Let''s practice pronouncing each phrase together step by step!","id":5,"vi":"Hãy cùng luyện phát âm từng cụm từ theo hướng dẫn từng bước nhé!","end":24,"start":18.8,"endFormatted":"00:00:24.000","startFormatted":"00:00:18.800"}]', '2026-08-15T03:49:15.554Z', '2026-08-15T03:59:28.827Z', FALSE),
  (25, 36, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:49:15.911Z', '2026-08-15T03:49:15.911Z', FALSE),
  (26, 37, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', '[{"en":"Hello everyone! Welcome back to our English Grammar lesson.","id":1,"vi":"Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Today, we are learning about Subject Pronouns and Object Pronouns in English.","id":2,"vi":"Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Look at the key example on the screen: I see them.","id":3,"vi":"Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).","end":14,"start":8.8,"endFormatted":"00:00:14.000","startFormatted":"00:00:08.800"},{"en":"In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.","id":4,"vi":"Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.","end":19.5,"start":14.3,"endFormatted":"00:00:19.500","startFormatted":"00:00:14.300"},{"en":"Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.","id":5,"vi":"Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.","end":25.5,"start":19.8,"endFormatted":"00:00:25.500","startFormatted":"00:00:19.800"},{"en":"Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.","id":6,"vi":"Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.","end":31.5,"start":25.8,"endFormatted":"00:00:31.500","startFormatted":"00:00:25.800"},{"en":"For instance: They see me, She helps him, and We listen to them carefully.","id":7,"vi":"Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).","end":37.5,"start":31.8,"endFormatted":"00:00:37.500","startFormatted":"00:00:31.800"},{"en":"Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.","id":8,"vi":"Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.","end":44,"start":37.8,"endFormatted":"00:00:44.000","startFormatted":"00:00:37.800"},{"en":"Now, let''s practice speaking and making sentences with Subject and Object pronouns together!","id":9,"vi":"Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!","end":50,"start":44.3,"endFormatted":"00:00:50.000","startFormatted":"00:00:44.300"}]', '2026-08-15T03:49:16.478Z', '2026-08-15T03:59:28.964Z', FALSE),
  (27, 38, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome to Bài học mới.
Chào mừng tất cả các bạn đến với bài học Bài học mới.

2
00:00:04.200 --> 00:00:08.500
In this lesson, we will focus on essential daily English communication skills.
Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.

3
00:00:09.000 --> 00:00:13.500
Please listen carefully and repeat after the native speaker.
Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.

4
00:00:14.000 --> 00:00:18.500
Practice makes perfect. Let''s start speaking with confidence!
Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!

', '[{"en":"Hello everyone! Welcome to Bài học mới.","id":1,"vi":"Chào mừng tất cả các bạn đến với bài học Bài học mới.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"In this lesson, we will focus on essential daily English communication skills.","id":2,"vi":"Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Please listen carefully and repeat after the native speaker.","id":3,"vi":"Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ.","end":13.5,"start":9,"endFormatted":"00:00:13.500","startFormatted":"00:00:09.000"},{"en":"Practice makes perfect. Let''s start speaking with confidence!","id":4,"vi":"Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!","end":18.5,"start":14,"endFormatted":"00:00:18.500","startFormatted":"00:00:14.000"}]', '2026-08-15T03:49:16.836Z', '2026-08-15T03:49:16.836Z', FALSE),
  (28, 39, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', '[{"en":"Hello everyone! Welcome back to our English Grammar lesson.","id":1,"vi":"Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Today, we are learning about Subject Pronouns and Object Pronouns in English.","id":2,"vi":"Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Look at the key example on the screen: I see them.","id":3,"vi":"Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).","end":14,"start":8.8,"endFormatted":"00:00:14.000","startFormatted":"00:00:08.800"},{"en":"In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.","id":4,"vi":"Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.","end":19.5,"start":14.3,"endFormatted":"00:00:19.500","startFormatted":"00:00:14.300"},{"en":"Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.","id":5,"vi":"Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.","end":25.5,"start":19.8,"endFormatted":"00:00:25.500","startFormatted":"00:00:19.800"},{"en":"Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.","id":6,"vi":"Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.","end":31.5,"start":25.8,"endFormatted":"00:00:31.500","startFormatted":"00:00:25.800"},{"en":"For instance: They see me, She helps him, and We listen to them carefully.","id":7,"vi":"Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).","end":37.5,"start":31.8,"endFormatted":"00:00:37.500","startFormatted":"00:00:31.800"},{"en":"Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.","id":8,"vi":"Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.","end":44,"start":37.8,"endFormatted":"00:00:44.000","startFormatted":"00:00:37.800"},{"en":"Now, let''s practice speaking and making sentences with Subject and Object pronouns together!","id":9,"vi":"Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!","end":50,"start":44.3,"endFormatted":"00:00:50.000","startFormatted":"00:00:44.300"}]', '2026-08-15T03:49:17.389Z', '2026-08-15T03:59:29.101Z', FALSE),
  (29, 40, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', '[{"en":"Hello everyone! Welcome back to our English Grammar lesson.","id":1,"vi":"Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Today, we are learning about Subject Pronouns and Object Pronouns in English.","id":2,"vi":"Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Look at the key example on the screen: I see them.","id":3,"vi":"Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).","end":14,"start":8.8,"endFormatted":"00:00:14.000","startFormatted":"00:00:08.800"},{"en":"In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.","id":4,"vi":"Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.","end":19.5,"start":14.3,"endFormatted":"00:00:19.500","startFormatted":"00:00:14.300"},{"en":"Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.","id":5,"vi":"Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.","end":25.5,"start":19.8,"endFormatted":"00:00:25.500","startFormatted":"00:00:19.800"},{"en":"Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.","id":6,"vi":"Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.","end":31.5,"start":25.8,"endFormatted":"00:00:31.500","startFormatted":"00:00:25.800"},{"en":"For instance: They see me, She helps him, and We listen to them carefully.","id":7,"vi":"Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).","end":37.5,"start":31.8,"endFormatted":"00:00:37.500","startFormatted":"00:00:31.800"},{"en":"Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.","id":8,"vi":"Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.","end":44,"start":37.8,"endFormatted":"00:00:44.000","startFormatted":"00:00:37.800"},{"en":"Now, let''s practice speaking and making sentences with Subject and Object pronouns together!","id":9,"vi":"Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!","end":50,"start":44.3,"endFormatted":"00:00:50.000","startFormatted":"00:00:44.300"}]', '2026-08-15T03:49:17.759Z', '2026-08-15T03:59:29.239Z', FALSE),
  (30, 41, 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', 'WEBVTT

1
00:00:00.000 --> 00:00:04.000
Hello everyone! Welcome back to our English Grammar lesson.
Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.

2
00:00:04.200 --> 00:00:08.500
Today, we are learning about Subject Pronouns and Object Pronouns in English.
Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.

3
00:00:08.800 --> 00:00:14.000
Look at the key example on the screen: I see them.
Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).

4
00:00:14.300 --> 00:00:19.500
In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.
Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.

5
00:00:19.800 --> 00:00:25.500
Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.
Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.

6
00:00:25.800 --> 00:00:31.500
Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.
Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.

7
00:00:31.800 --> 00:00:37.500
For instance: They see me, She helps him, and We listen to them carefully.
Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).

8
00:00:37.800 --> 00:00:44.000
Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.
Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.

9
00:00:44.300 --> 00:00:50.000
Now, let''s practice speaking and making sentences with Subject and Object pronouns together!
Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!

', '[{"en":"Hello everyone! Welcome back to our English Grammar lesson.","id":1,"vi":"Xin chào các bạn! Chào mừng các bạn quay trở lại với bài học Ngữ pháp Tiếng Anh.","end":4,"start":0,"endFormatted":"00:00:04.000","startFormatted":"00:00:00.000"},{"en":"Today, we are learning about Subject Pronouns and Object Pronouns in English.","id":2,"vi":"Hôm nay, chúng ta sẽ cùng học về Đại từ nhân xưng làm chủ ngữ và Đại từ tân ngữ trong tiếng Anh.","end":8.5,"start":4.2,"endFormatted":"00:00:08.500","startFormatted":"00:00:04.200"},{"en":"Look at the key example on the screen: I see them.","id":3,"vi":"Hãy nhìn vào ví dụ trọng tâm trên màn hình: I see them (Tôi nhìn thấy họ).","end":14,"start":8.8,"endFormatted":"00:00:14.000","startFormatted":"00:00:08.800"},{"en":"In this sentence, ''I'' is the Subject Pronoun, and ''them'' is the Object Pronoun receiving the action.","id":4,"vi":"Trong câu này, ''I'' là Đại từ chủ ngữ, và ''them'' là Đại từ tân ngữ chịu tác động của hành động.","end":19.5,"start":14.3,"endFormatted":"00:00:19.500","startFormatted":"00:00:14.300"},{"en":"Subject pronouns always stand before the main verb: I, You, We, They, He, She, It.","id":5,"vi":"Đại từ chủ ngữ luôn đứng trước động từ chính: I, You, We, They, He, She, It.","end":25.5,"start":19.8,"endFormatted":"00:00:25.500","startFormatted":"00:00:19.800"},{"en":"Object pronouns always stand after the verb or preposition: Me, You, Us, Them, Him, Her, It.","id":6,"vi":"Đại từ tân ngữ luôn đứng sau động từ hoặc giới từ: Me, You, Us, Them, Him, Her, It.","end":31.5,"start":25.8,"endFormatted":"00:00:31.500","startFormatted":"00:00:25.800"},{"en":"For instance: They see me, She helps him, and We listen to them carefully.","id":7,"vi":"Ví dụ: They see me (Họ thấy tôi), She helps him (Cô ấy giúp anh ấy), và We listen to them (Chúng tôi lắng nghe họ).","end":37.5,"start":31.8,"endFormatted":"00:00:37.500","startFormatted":"00:00:31.800"},{"en":"Always pay close attention to the position of the pronoun in your sentence to avoid mistakes.","id":8,"vi":"Hãy luôn chú ý đến vị trí của đại từ trong câu để không bị nhầm lẫn giữa chủ ngữ và tân ngữ nhé.","end":44,"start":37.8,"endFormatted":"00:00:44.000","startFormatted":"00:00:37.800"},{"en":"Now, let''s practice speaking and making sentences with Subject and Object pronouns together!","id":9,"vi":"Bây giờ, hãy cùng nhau luyện tập phát âm và đặt câu với các đại từ chủ ngữ và tân ngữ này nhé!","end":50,"start":44.3,"endFormatted":"00:00:50.000","startFormatted":"00:00:44.300"}]', '2026-08-15T03:49:18.151Z', '2026-08-15T03:59:29.376Z', FALSE)
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"lesson_subtitles"', 'subtitle_id'), coalesce(max("subtitle_id"), 1), max("subtitle_id") IS NOT NULL) FROM "lesson_subtitles";

-- Dữ liệu bảng pdf_notes (2 records)
INSERT INTO "pdf_notes" ("note_id", "user_id", "lesson_id", "material_id", "document_ref", "page_number", "selected_text", "note_text", "category", "color", "rects", "context_before", "context_after", "created_at", "updated_at", "selection_type")
VALUES
  ('1', 5, 29, NULL, 'lesson:29:primary:v1', 1, NULL, 'công thức', 'not_understood', 'yellow', '[{"x":0.644,"y":0.1409,"width":0.2659,"height":0.0844}]', '', '', '2026-08-19T04:01:44.758Z', '2026-08-19T04:01:44.758Z', 'area'),
  ('2', 4, 32, NULL, 'lesson:32:primary:v1', 1, 'Mind maps (Sơ đồ tư duy) là phương pháp học tập nhằm tối ưu khả năng ghi nhớ kiến thức bằng
cách sử dụng từ khóa và hình ảnh. Khi học Ngoại ngữ, Mindmaps sẽ cung cấp “bức tranh tổng thể"
bao quát cho các đơn vị kiến thức đã học. Từ đó, học sinh có thể xâu chuỗi, hệ thống hoá kiến thức
nhanh chóng. Đồng thời, màu sắc bắt mắt và hình ảnh sinh động giúp phân biệt, hình dung dễ dàng
các đơn vị kiến thức và kích thích sự sáng tạo của học sinh.', 'Ghi chú', 'important', 'yellow', '[{"x":0.0926,"y":0.0365,"width":0.8233,"height":0.0182},{"x":0.0926,"y":0.0583,"width":0.8445,"height":0.0182},{"x":0.0926,"y":0.08,"width":0.8427,"height":0.0182},{"x":0.0926,"y":0.1017,"width":0.8429,"height":0.0182},{"x":0.0926,"y":0.1234,"width":0.5056,"height":0.0182}]', '', '', '2026-08-19T06:09:45.202Z', '2026-08-19T06:09:45.202Z', 'text')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"pdf_notes"', 'note_id'), coalesce(max("note_id"), 1), max("note_id") IS NOT NULL) FROM "pdf_notes";

-- Dữ liệu bảng pending_media_uploads (3 records)
INSERT INTO "pending_media_uploads" ("upload_id", "instructor_id", "storage_provider", "storage_bucket", "storage_key", "mime_type", "size_bytes", "checksum_sha256", "status", "created_at", "expires_at", "claimed_at")
VALUES
  ('3c36a4c1-302f-4176-a975-64c69df954c1', 5, 'supabase', 'videos', 'courses/5/36d2c325-7ca4-43b3-bfb2-8ec659a61c79/Everyday_Conversations.mp4', 'video/mp4', '19396114', 'a06b798d730e39ce554d2dcfab0f35f405eb857898a8e704716a5c21a57e1142', 'COMMITTED', '2026-08-20T12:33:15.406Z', '2026-08-21T12:33:15.406Z', '2026-08-20T12:33:28.506Z'),
  ('d29bf32e-9803-48e1-9bea-1297104f4d05', 5, 'supabase', 'videos', 'courses/5/d972ebeb-5107-47c4-a469-ea4d3a92a1ee/Speak_English_Clearly.mp4', 'video/mp4', '18351854', 'eb9d43429d49d1fa9bbc31405461ebfebc4bdf1f400b2d1008e6f2578aba9918', 'COMMITTED', '2026-08-20T13:14:15.432Z', '2026-08-21T13:14:15.432Z', '2026-08-20T13:14:18.000Z'),
  ('d936cc38-1348-4edf-8774-a1e765b0edcb', 5, 'supabase', 'videos', 'courses/5/7c56e538-b941-4046-a405-5c1a0cc478a0/Everyday_Conversations.mp4', 'video/mp4', '19396114', 'a06b798d730e39ce554d2dcfab0f35f405eb857898a8e704716a5c21a57e1142', 'COMMITTED', '2026-08-20T13:14:07.889Z', '2026-08-21T13:14:07.889Z', '2026-08-20T13:14:18.000Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"pending_media_uploads"', 'upload_id'), coalesce(max("upload_id"), 1), max("upload_id") IS NOT NULL) FROM "pending_media_uploads";

-- Dữ liệu bảng failed_storage_deletions (4 records)
INSERT INTO "failed_storage_deletions" ("deletion_id", "storage_provider", "storage_bucket", "storage_key", "retry_count", "last_error", "status", "created_at", "next_retry_at", "resolved_at")
VALUES
  (1, 'supabase', 'videos', 'courses/2/1d85f458-ed0a-4e52-8710-30319564312a/Lesson1_Intro.mp4', 1, 'Pending registration failed: insert or update on table "pending_media_uploads" violates foreign key constraint "pending_media_uploads_instructor_id_fkey"', 'PENDING_RETRY', '2026-08-20T05:04:07.443Z', '2026-08-20T05:09:07.443Z', NULL),
  (2, 'supabase', 'videos', 'courses/2/cd45d920-59b1-4c37-af09-88b32c1a2358/Grammar_Lesson.mp4', 1, 'Pending registration failed: insert or update on table "pending_media_uploads" violates foreign key constraint "pending_media_uploads_instructor_id_fkey"', 'PENDING_RETRY', '2026-08-20T05:04:08.563Z', '2026-08-20T05:09:08.563Z', NULL),
  (3, 'supabase', 'documents', 'courses/2/ee8dfca7-ceea-4292-a392-f030655a28de/Unit1_Grammar.pdf', 1, 'Pending registration failed: insert or update on table "pending_media_uploads" violates foreign key constraint "pending_media_uploads_instructor_id_fkey"', 'PENDING_RETRY', '2026-08-20T05:04:09.589Z', '2026-08-20T05:09:09.589Z', NULL),
  (4, 'supabase', 'documents', 'courses/2/2eac5a52-119f-4170-8584-e35340bac123/DurableDoc.pdf', 1, 'Pending registration failed: insert or update on table "pending_media_uploads" violates foreign key constraint "pending_media_uploads_instructor_id_fkey"', 'PENDING_RETRY', '2026-08-20T05:04:10.616Z', '2026-08-20T05:09:10.616Z', NULL)
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('"failed_storage_deletions"', 'deletion_id'), coalesce(max("deletion_id"), 1), max("deletion_id") IS NOT NULL) FROM "failed_storage_deletions";

