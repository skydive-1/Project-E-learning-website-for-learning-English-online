# Báo cáo kiểm tra mức độ sẵn sàng trước bảo vệ

Ngày đối soát ban đầu: 02/09/2026. Cập nhật kết quả test/build: 12/09/2026. Kết luận chung: **đủ bằng chứng kỹ thuật để bảo vệ đồ án; chưa nên gọi mọi tích hợp bên ngoài là production-verified**. Các kết luận bên dưới chỉ bao phủ những gì test, production build, truy vấn chỉ đọc hoặc trace trực tiếp đường đi của request đã chứng minh.

## 1. CONFIRMED FIXED — Đã sửa và có bằng chứng

### 1.1. Cổng hoàn thành bài học tối thiểu 50% đã nằm ở backend

- Backend lấy điểm cao nhất đã lưu trong `quiz_attempts`, không nhận điểm do client gửi: `backend/src/modules/progress/services/progress.service.js:35`.
- Nếu điểm đã lưu nhỏ hơn 50, service trả HTTP 422 với mã `LESSON_COMPLETION_SCORE_TOO_LOW`: `backend/src/modules/progress/services/progress.service.js:49`.
- Controller yêu cầu `isCompleted` là boolean rõ ràng, không còn mặc định ngầm thành `true`: `backend/src/modules/progress/controllers/progress.controller.js:50`.
- Bài test gửi raw HTTP request với điểm đã lưu 49%, đồng thời thử nhét `score: 100` vào body để giả mạo: `backend/tests/progress_completion_threshold.test.js:106` và `backend/tests/progress_completion_threshold.test.js:120`.
- Bằng chứng chạy ngày 12/09/2026: `npm --prefix backend test` đạt **325 test, 325 pass, 0 fail, 0 skipped, 0 todo**. Bộ test gồm các ca ngưỡng hoàn thành, grounding và điều phối model theo RPD.

### 1.2. Pipeline tạo phụ đề tự động đã được khôi phục ở mức xử lý cục bộ

- Lịch sử Git xác nhận file bắt đầu từ commit `c1e456f` (`Create auto subtitle pipline.py`). Script hiện có CLI hoàn chỉnh, tự tìm FFmpeg, tách audio, phát hiện đoạn có giọng nói, chạy song song và xuất JSON: `backend/scripts/auto_subtitle_pipeline.py:86`, `:215`, `:237`, `:277`, `:328`.
- Backend mặc định bật VAD và không còn âm thầm chuyển sang một đường xử lý khác khi script lỗi: `backend/src/modules/lessons/services/subtitles.service.js:693`. Trường hợp không phát hiện giọng nói trả 422 với mã `SUBTITLE_NO_SPEECH_DETECTED`: cùng file, dòng 700. Đường xử lý trực tiếp chỉ được dùng khi `ENABLE_SUBTITLE_VAD=false`: dòng 707.
- Cấu hình mẫu đã bật VAD: `backend/.env.example:41`.
- Bằng chứng chạy cục bộ:

  ```text
  python scripts/auto_subtitle_pipeline.py C:\tmp\subtitle_silence.wav \
    --workers 1 --output C:\tmp\auto_subtitle_silence_e2e.json
  Exit code: 0
  durationMs: 1000
  speechSegments: 0
  cues: []
  ```

  Lần chạy này chứng minh chuỗi FFmpeg → VAD → JSON hoạt động với file audio thật trên máy. Phần gọi Gemini với tiếng nói được tách riêng ở mục UNVERIFIED.

### 1.3. Model embedding trong code và tài liệu nguồn đã thống nhất

- Model mặc định lúc chạy là `gemini-embedding-001`: `backend/src/utils/ai-clients.js:298`.
- Pipeline RAG dùng cùng model tại `rag-training/config.yaml:8` và `rag-training/src/config.py:25`.
- README và mã sinh tài liệu luận văn đã được sửa sang `gemini-embedding-001`, vector 768 chiều: `README.md:36`, `backend/scripts/generate_thesis_defense_doc.py:252`, `:279`.
- Tìm toàn repo sau khi sửa không còn kết quả `text-embedding-004` trong file văn bản được theo dõi.

### 1.4. Số lượng contraction thực tế là 33

- Nguồn dữ liệu thật là `CONTRACTIONS_MAP` trong `backend/src/utils/speakingScorer.js:14`, được export tại dòng 464.
- Lệnh đọc trực tiếp module trả về `CONTRACTIONS_MAP_COUNT=33`:

  ```text
  node -e "const { CONTRACTIONS_MAP }=require('./backend/src/utils/speakingScorer'); console.log(Object.keys(CONTRACTIONS_MAP).length)"
  33
  ```

- Test căn chỉnh contraction trong bộ backend đã đạt. Con số cần dùng để sửa luận văn là **33**, không phải con số ước lượng trong tài liệu cũ.

### 1.5. Các fallback giả dữ liệu khi API lỗi đã được gỡ khỏi các luồng đã tìm thấy

- Quiz frontend không còn trả dữ liệu mẫu hoặc báo thành công giả khi API lỗi; lỗi được ném lên UI. Hai hàm lưu từng là no-op nay gọi API thật: `frontend/src/modules/quizzes/services/quizzes.service.js:169` và `:193`.
- Lesson service đã bỏ nội dung và thời lượng hard-code theo ID/thứ tự bài; dữ liệu nay lấy từ response backend: `frontend/src/modules/lessons/services/lessons.service.js:89`, `:272`.
- Chatbot empty state không còn bốn prompt mẫu giả dạng dữ liệu từ server. Component có trạng thái loading, lỗi và nút thử lại: `frontend/src/modules/chatbot/components/EmptyState.jsx:58`.
- Trang analytics và danh sách khóa học hiển thị lỗi thay vì biến lỗi mạng thành mảng rỗng hoặc số 0: `frontend/src/modules/analytics/pages/AnalyticsDashboardPage.jsx:126`, `frontend/src/modules/courses/pages/CourseListPage.jsx:380`.
- Đăng ký tư vấn không còn báo gửi thành công khi SMTP thiếu hoặc gửi thất bại. Backend trả lỗi 503: `backend/src/modules/consultation/consultation.service.js:142`, `:169`.
- Quick quiz ở backend không còn dựng câu hỏi chung khi thiếu nội dung hoặc Gemini trả sai schema; các trường hợp này trả 422/502: `backend/src/modules/chatbot/services/chatbot.service.js:623`, `:668`, `:682`.
- Bằng chứng biên dịch và kiểm thử frontend ngày 12/09/2026: `npm --prefix frontend run build` thành công; `npm --prefix frontend test` đạt **236/236 test trong 55 file**.

### 1.6. Logging, cấu hình production và rate limit đã được siết lại

- Mỗi request có ID, response header và log gồm status, thời gian, user và path: `backend/src/middleware/logger.middleware.js:1`, `:14`. Logger được gắn trước các route tại `backend/src/server.js:89`.
- Error middleware log stack ở server, trả `requestId`, và không trả nội dung lỗi nội bộ cho client khi status là 500: `backend/src/middleware/error.middleware.js:58`, `:71`. Test PDF notes kiểm tra việc không rò thông tin nội bộ và đã đạt trong bộ 325 test.
- Production startup kiểm tra JWT, URL frontend, Gemini, Pinecone, Supabase, SMTP, database, `ENABLE_DRM_PACKAGING` và `ENABLE_SUBTITLE_VAD`: `backend/src/config/environment.js:1`. Có năm test cho validator này và cả năm đều đạt.
- Khi database không kết nối được ở production, server đóng thay vì tiếp tục chạy nửa vời: `backend/src/server.js:152`.
- CORS không còn chấp nhận tùy ý mọi subdomain `vercel.app`: `backend/src/server.js:76`.
- Global limiter và API limiter được gắn tại `backend/src/server.js:86`, `:107`; các route đăng nhập, reset mật khẩu, AI, upload, media và stream có limiter theo chức năng. Route lấy phụ đề nay yêu cầu xác thực và `aiLimiter`: `backend/src/modules/lessons/lessons.routes.js:42`.
- Production không thể tắt rate limit bằng biến môi trường: `backend/src/middleware/rateLimit.middleware.js:14`. Năm test hồi quy rate limit mới thêm đều đạt.
- Router Gemini đọc RPD do backend quan sát theo cache 15 giây. Model chạm cap được bỏ qua đến 00:00 Pacific; nếu cap cấu hình lệch, phản hồi 429 từ Google vẫn kích hoạt fallback và giữ model ngoài hàng đợi đến mốc reset. Telemetry nội bộ không được gắn nhãn là số liệu Google.

### 1.7. Đường đi DRM/DASH, watermark và phần lớn chuỗi RAG có kết nối thật trong code

- Upload video gọi Shaka packager và đánh dấu nội dung được bảo vệ: `backend/src/modules/courses/controllers/courses.controller.js:124`, `:210`. Manifest, segment và license đi qua route được bảo vệ: `backend/src/modules/lessons/lessons.routes.js:28`, `:31`, `backend/src/modules/drm/drm.routes.js:20`.
- Frontend khởi tạo Shaka Player, gắn ticket header, cấu hình ClearKey và render watermark theo user/thời gian: `frontend/src/modules/lessons/pages/LessonDetailPage.jsx:972`, `:990`, `:1016`, `:1561`.
- Máy kiểm tra có `backend/bin/shaka-packager.exe`, phiên bản 3.9.3. Truy vấn chỉ đọc cho thấy 4/4 video lesson hiện có đều dùng DASH. Bộ backend có 14 test video/streaming đạt; test hợp đồng ticket frontend cũng đạt.
- Với RAG, request thật đi qua history, intent router, query rewriter/contextualizer, retrieval và source verification: `backend/src/modules/chatbot/services/chatbot.service.js:771`, `:795`, `:825`, `:832`, `:885`. Hybrid search trộn semantic và PostgreSQL rồi áp ngưỡng 0.58 ở `backend/src/modules/chatbot/services/hybridSearch.service.js:16`, `:147`, `:235`. Query lịch sử lọc theo `student_id` và `lesson_id` trong `backend/src/modules/chatbot/services/queryRewriter.service.js:69`. Test cách ly owner/history đã đạt trong bộ backend.

Các bằng chứng trên chỉ xác nhận wiring, hợp đồng và dữ liệu hiện tại. Trình duyệt thật, EME và nhà cung cấp AI/vector được tách sang mục UNVERIFIED.

### 1.8. Dependency Python của pipeline phụ đề đã khớp SDK được import

- `auto_subtitle_pipeline.py` dùng SDK mới qua `from google import genai`; requirements nay cài `google-genai>=2.10.0,<3.0.0`: `backend/requirements.txt:3` và `backend/scripts/requirements.txt:3`. Package cũ `google-generativeai` đã được bỏ khỏi hai file này.
- Virtualenv mới tại thư mục tạm đã cài sạch từ `backend/requirements.txt`; pip chọn `google-genai 2.21.0`, kết thúc exit code 0. `pip check` trả `No broken requirements found`.
- Chạy `auto_subtitle_pipeline.py --help` bằng đúng Python trong virtualenv mới trả exit code 0 và hiển thị đầy đủ CLI. Việc gọi Gemini với audio có tiếng vẫn được giữ ở mục UNVERIFIED.

### 1.9. Request RAG theo bài học đã có cổng grounding trước lời gọi Gemini

- Policy phân biệt intent cần nguồn (`current_lesson`, `course_wide`) với câu hỏi tiếng Anh tổng quát: `backend/src/modules/chatbot/services/groundingPolicy.service.js:5`.
- Cả đường sync và SSE đều xây dựng nguồn đã xác minh trước, rồi từ chối trả lời nếu thiếu một trong hai thành phần: context tin cậy và source đã đối chiếu PostgreSQL: `backend/src/modules/chatbot/services/chatbot.service.js:890`, `:900`, `:1078`, `:1098`.
- Prompt của intent theo bài học cấm dùng kiến thức ngoài và yêu cầu nói rõ khi context không đủ: `backend/src/modules/chatbot/services/groundingPolicy.service.js:25`. Intent `GENERAL_ENGLISH_QA` vẫn được phép trả lời kiến thức tiếng Anh chung, không bị trộn với dữ liệu khóa học.
- Nhánh current lesson nay lọc kết quả semantic theo ngưỡng mặc định 0.58; có thể cấu hình bằng `RAG_CONFIDENCE_THRESHOLD`: `backend/src/modules/chatbot/services/chatbot.service.js:270`, `backend/.env.example:29`.
- Năm test policy đạt, gồm kiểm tra hai scope cần grounding, tách general English, yêu cầu đủ context + source, nội dung prompt và thứ tự gate đứng trước cả hai lời gọi Gemini: `backend/tests/chatbot_grounding_policy.test.js:15`, `:33`, `:40`, `:47`.
- Generator luận văn không còn công bố `Grounded 100%`, `Faithfulness 98.2%`, hallucination 1.2%, Hit Rate 96.4% hoặc latency 0.68 giây như số đo thật. Bảng ghi rõ trạng thái chưa có phép đo đủ bằng chứng tại `backend/scripts/generate_thesis_defense_doc.py:365`; câu trả lời phản biện nêu đúng giới hạn tại dòng 472.
- File `SO_TAY_THUYET_TRINH_VA_BAO_VE_DO_AN_RAG_AI.docx` đã được sinh lại. Kiểm tra trực tiếp toàn bộ paragraph và table trong DOCX xác nhận có câu “Chưa có phép đo đủ bằng chứng” và không còn năm cụm số liệu/tuyên bố cũ nêu trên.

## 2. KNOWN LIMITATIONS — Giới hạn còn lại sau lần đối soát 12/09/2026

### 2.1. Versioned migration đã có, DDL tương thích lúc boot vẫn chưa bỏ hết

- Repo có `001_initial_schema.sql`, `002_quizzes_and_attempts_parity.sql` và các migration theo ngày. `migrationRunner.js` chạy file theo thứ tự, trong transaction, đồng thời lưu version và checksum vào `schema_migrations`.
- `schema.sql` đã chứa các cột quiz và nullability cần thiết. `schema_parity.test.js` kiểm tra initial schema, parity migration và việc migration đã chạy sẽ được bỏ qua ở lần sau.
- `database.js` vẫn giữ một số `ALTER TABLE ... IF NOT EXISTS` để nâng cấp database cũ. Lớp tương thích này làm schema change có hai đường thực thi; nên chuyển nốt DDL sang migration versioned rồi để startup chỉ gọi migration runner.

### 2.2. Forensic Watermark là biện pháp truy vết và răn đe

- Watermark định danh người xem và các cảnh báo tầng trình duyệt không thể ngăn tuyệt đối phần mềm quay cấp hệ điều hành, camera ngoài hoặc thiết bị capture. Khi bảo vệ cần mô tả đúng giới hạn này.

### 2.3. Profile stats đã nối API; thay avatar vẫn dùng hộp nhập URL

- `ProfilePage.jsx` gọi `GET /api/auth/stats` và hiển thị `enrolledCourses`, `avgProgress`, `aiChatCount`, `completedLessons` từ backend, kèm loading/error/empty state.
- Không còn “2 Khóa học”, “8.5 điểm” hoặc danh sách hoạt động mẫu. Luồng đổi avatar vẫn dùng `window.prompt` để nhập URL; đây là UX đơn giản, không phải dữ liệu giả.

### 2.4. Error handling, file log và health probes đã có; chưa gom log đa instance

- DRM và Gamification controller đã chuyển lỗi qua `next(error)`.
- Logger Pino ghi structured log ra stdout và `backend/logs/app.log`. Cấu hình hiện tại chưa gom log từ nhiều instance, phù hợp phạm vi triển khai 0 VND một instance nhưng không đủ cho cụm backend phân tán.
- `/health/live` trả liveness; `/health/ready` kiểm tra PostgreSQL và R2 như dependency bắt buộc, Gemini/Pinecone như dependency tùy chọn. Test xác nhận dependency bắt buộc lỗi sẽ trả HTTP 503.

### 2.5. Rate limit hỗ trợ shared store nhưng cấu hình 0 VND vẫn chạy một instance

- Khi không có Redis URL, `express-rate-limit` dùng MemoryStore và production ghi log rằng hệ thống đang ở chế độ 0 VND một instance.
- Khi có `REDIS_URL` hoặc `REDIS_TLS_URL`, code tạo `RedisStore`. `RATE_LIMIT_REQUIRE_SHARED_STORE=true` phát cảnh báo nếu thiếu shared store.
- Không được scale ngang bằng MemoryStore. Dự án không yêu cầu bật Billing hoặc mua Redis; nếu không có lựa chọn miễn phí phù hợp thì giữ một instance.

### 2.6. Một số test mang tên lớn hơn phạm vi chúng kiểm tra

- `backend/tests/rate_limit.test.js:102` chỉ gửi một request cho từng endpoint giả lập; nó chứng minh middleware được gọi trong test app, chưa chứng minh route production thật trả 429.
- `backend/tests/media_lifecycle_regression.test.js:27` chủ yếu kiểm tra module/router load được, không chạy DASH lifecycle.
- `backend/scripts/test_e2e_rag.js:118` chỉ kiểm tra service export hàm.
- Không có test bị `.skip`, `.todo` hoặc `.only`, nhưng ba trường hợp trên cần đổi tên hoặc thay bằng integration test thật để tránh hiểu nhầm mức bao phủ.

### 2.7. Frontend bundle đã tách; vẫn cần performance budget

- Production build ngày 12/09/2026 thành công, không còn cảnh báo chunk vượt ngưỡng cấu hình. Main JS còn **690.56 kB**, gzip **226.41 kB**.
- Shaka (**812.22 kB**), PDF (**462.38 kB**) và charts (**458.38 kB**) nằm ở các chunk riêng. PDF worker **1,046.21 kB** chỉ tải cùng luồng PDF.
- Chưa có Lighthouse artifact hoặc budget kiểm tra trong CI, vì vậy không công bố FCP/LCP trên 4G như số đã đo.

## 3. UNVERIFIED — Chưa đủ điều kiện xác minh

### 3.1. Chuyển giọng nói thật thành phụ đề qua Gemini

Lần chạy audio im lặng đã chứng minh phần FFmpeg/VAD/JSON. Không có lần chạy được phép gửi audio có giọng nói ra Gemini trong phiên kiểm tra này, nên độ chính xác transcript, timestamp theo tiếng nói, retry và quota thực tế vẫn **UNVERIFIED**. Cần một file mẫu đã được cho phép truyền ra ngoài, API key hợp lệ, sau đó lưu log request, response và so sánh với transcript chuẩn.

### 3.2. Một truy vấn RAG live qua Gemini và Pinecone

Trace code xác nhận các hàm có được gọi theo đường request, nhưng phiên kiểm tra không gửi nội dung bài học thật ra nhà cung cấp bên ngoài. Vì vậy chất lượng intent routing, rewrite, hybrid retrieval, latency và behavior khi provider lỗi trong môi trường thật vẫn **UNVERIFIED**. Cần dataset không nhạy cảm, index staging và một integration test chạy qua HTTP thật.

### 3.3. Phát video DRM trong trình duyệt thật

Code, database và contract test xác nhận đường DASH/ClearKey/ticket/watermark được nối. Chưa có phiên Playwright/Cypress chạy Shaka + EME trên Chrome/Safari với manifest, segment và license thật, nên phát lại end-to-end, seek, refresh ticket và watermark theo user vẫn **UNVERIFIED**. Cần chạy browser test trên staging và ghi artifact video/network trace.

### 3.4. Gửi email qua SMTP thật

Code nay trả lỗi rõ ràng khi thiếu cấu hình hoặc gửi thất bại, nhưng chưa gửi một email staging và xác nhận message được nhận. Cần tài khoản SMTP thử nghiệm hoặc mail sandbox cùng test kiểm tra message ID và nội dung.

### 3.5. Toàn bộ test frontend ✅ Đã xác minh

`frontend/package.json` có script `test: vitest run`. Lần chạy ngày 12/09/2026 đạt **55/55 test files, 236/236 tests, 0 fail**. Runner còn in cảnh báo cấu hình `esbuild` đã deprecated trong plugin React Babel; cảnh báo này không làm test hoặc build thất bại nhưng nên dọn khi nâng Vite/plugin.

### 3.6. Cấu hình và quan sát trên môi trường production thật

Validator và test startup đã đạt; máy cục bộ có các nhóm biến môi trường chính mà không cần in giá trị bí mật. Chưa có deploy production-like để chứng minh secret thực sự đúng, quyền database/object storage đủ, log được thu bền và readiness hoạt động qua restart. Cần một staging deploy bằng đúng manifest production và một checklist smoke test có lưu artifact.
