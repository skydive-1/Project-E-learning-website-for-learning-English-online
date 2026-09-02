# Báo cáo kiểm tra mức độ sẵn sàng trước bảo vệ

Ngày đối soát: 02/09/2026. Kết luận chung: **chưa đủ căn cứ để xác nhận hệ thống sẵn sàng vận hành production**. Các kết luận bên dưới chỉ bao phủ những gì đã được chứng minh bằng test, kết quả tìm kiếm mã nguồn, truy vấn chỉ đọc hoặc trace trực tiếp đường đi của request.

## 1. CONFIRMED FIXED — Đã sửa và có bằng chứng

### 1.1. Cổng hoàn thành bài học tối thiểu 50% đã nằm ở backend

- Backend lấy điểm cao nhất đã lưu trong `quiz_attempts`, không nhận điểm do client gửi: `backend/src/modules/progress/services/progress.service.js:35`.
- Nếu điểm đã lưu nhỏ hơn 50, service trả HTTP 422 với mã `LESSON_COMPLETION_SCORE_TOO_LOW`: `backend/src/modules/progress/services/progress.service.js:49`.
- Controller yêu cầu `isCompleted` là boolean rõ ràng, không còn mặc định ngầm thành `true`: `backend/src/modules/progress/controllers/progress.controller.js:50`.
- Bài test gửi raw HTTP request với điểm đã lưu 49%, đồng thời thử nhét `score: 100` vào body để giả mạo: `backend/tests/progress_completion_threshold.test.js:106` và `backend/tests/progress_completion_threshold.test.js:120`.
- Bằng chứng chạy: `npm --prefix backend test` đạt **160 test, 160 pass, 0 fail, 0 skipped, 0 todo**. Hai ca kiểm thử ngưỡng hoàn thành đều nằm trong lần chạy này.

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
- Bằng chứng biên dịch và kiểm thử frontend: `npm --prefix frontend run build` thành công; `npm exec -- vitest run tests/lessonSuggestedQuestions.test.jsx tests/videoTicketContract.test.jsx` chạy từ thư mục frontend đạt **13/13 test**.

### 1.6. Logging, cấu hình production và rate limit đã được siết lại

- Mỗi request có ID, response header và log gồm status, thời gian, user và path: `backend/src/middleware/logger.middleware.js:1`, `:14`. Logger được gắn trước các route tại `backend/src/server.js:89`.
- Error middleware log stack ở server, trả `requestId`, và không trả nội dung lỗi nội bộ cho client khi status là 500: `backend/src/middleware/error.middleware.js:58`, `:71`. Test PDF notes kiểm tra việc không rò thông tin nội bộ và đã đạt trong bộ 160 test.
- Production startup kiểm tra JWT, URL frontend, Gemini, Pinecone, Supabase, SMTP, database, `ENABLE_DRM_PACKAGING` và `ENABLE_SUBTITLE_VAD`: `backend/src/config/environment.js:1`. Có năm test cho validator này và cả năm đều đạt.
- Khi database không kết nối được ở production, server đóng thay vì tiếp tục chạy nửa vời: `backend/src/server.js:152`.
- CORS không còn chấp nhận tùy ý mọi subdomain `vercel.app`: `backend/src/server.js:76`.
- Global limiter và API limiter được gắn tại `backend/src/server.js:86`, `:107`; các route đăng nhập, reset mật khẩu, AI, upload, media và stream có limiter theo chức năng. Route lấy phụ đề nay yêu cầu xác thực và `aiLimiter`: `backend/src/modules/lessons/lessons.routes.js:42`.
- Production không thể tắt rate limit bằng biến môi trường: `backend/src/middleware/rateLimit.middleware.js:14`. Năm test hồi quy rate limit mới thêm đều đạt.

### 1.7. Đường đi DRM/DASH, watermark và phần lớn chuỗi RAG có kết nối thật trong code

- Upload video gọi Shaka packager và đánh dấu nội dung được bảo vệ: `backend/src/modules/courses/controllers/courses.controller.js:124`, `:210`. Manifest, segment và license đi qua route được bảo vệ: `backend/src/modules/lessons/lessons.routes.js:28`, `:31`, `backend/src/modules/drm/drm.routes.js:20`.
- Frontend khởi tạo Shaka Player, gắn ticket header, cấu hình ClearKey và render watermark theo user/thời gian: `frontend/src/modules/lessons/pages/LessonDetailPage.jsx:972`, `:990`, `:1016`, `:1561`.
- Máy kiểm tra có `backend/bin/shaka-packager.exe`, phiên bản 3.9.3. Truy vấn chỉ đọc cho thấy 4/4 video lesson hiện có đều dùng DASH. Bộ backend có 14 test video/streaming đạt; test hợp đồng ticket frontend cũng đạt.
- Với RAG, request thật đi qua history, intent router, query rewriter/contextualizer, retrieval và source verification: `backend/src/modules/chatbot/services/chatbot.service.js:771`, `:795`, `:825`, `:832`, `:885`. Hybrid search trộn semantic và PostgreSQL rồi áp ngưỡng 0.58 ở `backend/src/modules/chatbot/services/hybridSearch.service.js:16`, `:147`, `:235`. Query lịch sử lọc theo `student_id` và `lesson_id` trong `backend/src/modules/chatbot/services/queryRewriter.service.js:69`. Test cách ly owner/history đã đạt trong bộ backend.

Các bằng chứng trên chỉ xác nhận wiring, hợp đồng và dữ liệu hiện tại. Trình duyệt thật, EME và nhà cung cấp AI/vector được tách sang mục UNVERIFIED.

## 2. CONFIRMED BROKEN / INCOMPLETE — Đã xác nhận hỏng hoặc còn thiếu

### 2.1. Schema chuẩn và schema đang chạy bị lệch nhau

- `schema.sql` khai báo bảng `quizzes` tại `backend/schema.sql:121`, nhưng các cột `is_private`, `pin_code`, `updated_at` chỉ được thêm lúc boot ở `backend/src/config/database.js:174`.
- `schema.sql` khai báo `quiz_attempts.user_id` và `quiz_id` là `NOT NULL`: `backend/schema.sql:149`. Schema thật đọc từ database cho thấy cả hai đang nullable; boot migration chỉ ghi rõ việc bỏ `NOT NULL` cho `user_id` tại `backend/src/config/database.js:207`.
- Thư mục migration không có migration có phiên bản tương ứng cho hai thay đổi này. Nhiều boot migration bắt lỗi rồi chỉ cảnh báo và tiếp tục, nên một lần deploy lỗi có thể để schema ở trạng thái dở dang.
- Cách sửa: tạo migration có version, chạy trong transaction, cập nhật `schema.sql`, thêm bài test so sánh catalog với schema mong đợi, rồi bỏ DDL best-effort khỏi startup. Đây là lỗi cấu trúc chưa nên vá tự động khi chưa chốt quy tắc nullability của `quiz_id`.

### 2.2. Anti-hallucination của RAG chưa khóa câu trả lời vào nguồn

- Prompt hiện cho phép Gemini dùng kiến thức chung khi context rỗng hoặc không liên quan: `backend/src/modules/chatbot/services/chatbot.service.js:848`, `:865`, `:1041`, `:1055`.
- `buildVerifiedSources` chạy sau khi model đã sinh câu trả lời (`:885`, `:1083`). Nó xác thực thẻ nguồn, không chứng minh từng mệnh đề trong câu trả lời được nguồn hỗ trợ.
- Nhánh truy xuất current lesson tại `backend/src/modules/chatbot/services/chatbot.service.js:243` không áp cùng ngưỡng confidence 0.58 như hybrid course search.
- Cách sửa: buộc chế độ trả lời theo nguồn cho intent cần giáo trình, từ chối khi retrieval dưới ngưỡng, yêu cầu citation theo đoạn, kiểm tra citation trước khi trả response và tách rõ intent “kiến thức tiếng Anh chung”.

### 2.3. Các con số “Grounded 100%” và “Faithfulness 98.2%” chưa có phép đo tương ứng

- Mã sinh tài liệu vẫn ghi Faithfulness 98.2% và Grounded 100%: `backend/scripts/generate_thesis_defense_doc.py:365`, `:472`.
- Nhiều script báo cáo cũ còn tuyên bố 100% PASS hoặc sẵn sàng production, trong khi một số “E2E” chỉ kiểm tra hàm tồn tại. Ví dụ `backend/scripts/test_e2e_rag.js:118` chỉ kiểm tra kiểu của `ask`/`askStream`.
- Cách sửa: lập tập câu hỏi holdout, chấm retrieval và faithfulness bằng rubric có lưu output, nguồn và phiên bản model; chỉ đưa số đo có artifact tái chạy được vào luận văn.

### 2.4. Chống quay màn hình không thể đáp ứng lời hứa “ngăn chặn”

- Watermark và các cảnh báo trình duyệt có nối vào player, nhưng chính code ghi nhận không thể phát hiện OBS, quay ở cấp hệ điều hành hoặc camera ngoài: `frontend/src/modules/lessons/pages/LessonDetailPage.jsx:204`.
- Cách sửa tài liệu: mô tả đúng là biện pháp răn đe và truy vết. Nếu cần DRM mạnh hơn, dùng Widevine/FairPlay/PlayReady theo nền tảng; vẫn không nên tuyên bố chặn tuyệt đối việc ghi hình.

### 2.5. Profile còn hiển thị số liệu mẫu cố định

- Upload avatar còn comment dummy: `frontend/src/modules/profile/pages/ProfilePage.jsx:128`.
- “2 Khóa học”, “8.5 điểm” và hoạt động gần đây là giá trị tĩnh: `frontend/src/modules/profile/pages/ProfilePage.jsx:382`, `:414`, `:421`.
- Đây không phải fallback khi API lỗi, nhưng vẫn có thể làm người dùng hiểu nhầm dữ liệu. Cách sửa: nối endpoint thống kê thật hoặc ẩn toàn bộ khối cho tới khi có nguồn dữ liệu.

### 2.6. Error handling chưa đồng nhất và log chưa có nơi lưu bền

- DRM controller và gamification controller vẫn tự trả 500 thay vì chuyển qua error middleware chung: `backend/src/modules/drm/drm.controller.js:110`, `:165`, `backend/src/modules/gamification/controllers/gamification.controller.js:10`.
- Logger hiện ghi JSON qua `console`; repo không cấu hình transport/lưu trữ tập trung. Nếu nền tảng chạy container mà không thu stdout, log sự cố sẽ mất khi instance bị thay.
- Health endpoint chỉ trả trạng thái process, chưa kiểm tra database, object storage, Pinecone hoặc Gemini.
- Cách sửa: chuyển lỗi controller qua `next(error)`, dùng Pino/Winston với hệ thống thu log của môi trường triển khai, bổ sung `/health/live` và `/health/ready` với timeout ngắn cho dependency thiết yếu.

### 2.7. Rate limit dùng bộ nhớ từng process

- Factory trong `backend/src/middleware/rateLimit.middleware.js` không cấu hình shared store. Khi chạy nhiều instance, mỗi instance giữ bộ đếm riêng và giới hạn thực tế bị nhân lên.
- Cách sửa: dùng Redis-compatible store, đặt key theo user/IP phù hợp từng route và thêm test hai instance dùng chung store.

### 2.8. Một số test mang tên lớn hơn phạm vi chúng kiểm tra

- `backend/tests/rate_limit.test.js:102` chỉ gửi một request cho từng endpoint giả lập; nó chứng minh middleware được gọi trong test app, chưa chứng minh route production thật trả 429.
- `backend/tests/media_lifecycle_regression.test.js:27` chủ yếu kiểm tra module/router load được, không chạy DASH lifecycle.
- `backend/scripts/test_e2e_rag.js:118` chỉ kiểm tra service export hàm.
- Không có test bị `.skip`, `.todo` hoặc `.only`, nhưng ba trường hợp trên cần đổi tên hoặc thay bằng integration test thật để tránh hiểu nhầm mức bao phủ.

### 2.9. Frontend bundle quá lớn

- Production build thành công nhưng báo chunk chính **3,076.56 kB**, gzip **944.42 kB**; PDF worker **1,046.21 kB**. Vite cảnh báo chunk vượt 500 kB.
- Cách sửa: route-level lazy loading, tách Shaka/PDF/editor/dashboard thành chunk riêng, kiểm tra bundle analyzer và đặt budget trong CI.

## 3. UNVERIFIED — Chưa đủ điều kiện xác minh

### 3.1. Chuyển giọng nói thật thành phụ đề qua Gemini

Lần chạy audio im lặng đã chứng minh phần FFmpeg/VAD/JSON. Không có lần chạy được phép gửi audio có giọng nói ra Gemini trong phiên kiểm tra này, nên độ chính xác transcript, timestamp theo tiếng nói, retry và quota thực tế vẫn **UNVERIFIED**. Cần một file mẫu đã được cho phép truyền ra ngoài, API key hợp lệ, sau đó lưu log request, response và so sánh với transcript chuẩn.

### 3.2. Một truy vấn RAG live qua Gemini và Pinecone

Trace code xác nhận các hàm có được gọi theo đường request, nhưng phiên kiểm tra không gửi nội dung bài học thật ra nhà cung cấp bên ngoài. Vì vậy chất lượng intent routing, rewrite, hybrid retrieval, latency và behavior khi provider lỗi trong môi trường thật vẫn **UNVERIFIED**. Cần dataset không nhạy cảm, index staging và một integration test chạy qua HTTP thật.

### 3.3. Phát video DRM trong trình duyệt thật

Code, database và contract test xác nhận đường DASH/ClearKey/ticket/watermark được nối. Chưa có phiên Playwright/Cypress chạy Shaka + EME trên Chrome/Safari với manifest, segment và license thật, nên phát lại end-to-end, seek, refresh ticket và watermark theo user vẫn **UNVERIFIED**. Cần chạy browser test trên staging và ghi artifact video/network trace.

### 3.4. Gửi email qua SMTP thật

Code nay trả lỗi rõ ràng khi thiếu cấu hình hoặc gửi thất bại, nhưng chưa gửi một email staging và xác nhận message được nhận. Cần tài khoản SMTP thử nghiệm hoặc mail sandbox cùng test kiểm tra message ID và nội dung.

### 3.5. Toàn bộ test frontend

Frontend không có một script `test` tổng quát. Chỉ có production build và 13 test được chọn đã chạy. Do đó không có cơ sở báo số pass/fail/skip cho toàn bộ frontend. Cần chuẩn hóa `npm test` hoặc `vitest run`, khai báo môi trường jsdom và đưa lệnh đó vào CI.

### 3.6. File luận văn nhị phân hiện tại

Mã sinh tài liệu đã sửa tên embedding model, nhưng file DOCX/PDF hiện có chưa được sinh lại và đối chiếu nội dung trong lần kiểm tra này. Cần chạy generator, mở artifact mới và tìm cả `text-embedding-004`, các con số contraction cũ cùng các tuyên bố phần trăm chưa có benchmark.

### 3.7. Cấu hình và quan sát trên môi trường production thật

Validator và test startup đã đạt; máy cục bộ có các nhóm biến môi trường chính mà không cần in giá trị bí mật. Chưa có deploy production-like để chứng minh secret thực sự đúng, quyền database/object storage đủ, log được thu bền và readiness hoạt động qua restart. Cần một staging deploy bằng đúng manifest production và một checklist smoke test có lưu artifact.
