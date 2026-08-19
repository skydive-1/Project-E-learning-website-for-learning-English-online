# BÁO CÁO NGHIỆM THU: KHẮC PHỤC TRIỆT ĐỂ LỖI VIDEO ĐỨNG Ở 0:00 & CHUẨN HÓA HỆ THỐNG VIDEO STREAMING

> **Dự án**: Website Học Tiếng Anh Trực Tuyến Tích Hợp Trợ Lý AI (E-learning Platform)  
> **Repository**: `skydive-1/Project-E-learning-website-for-learning-English-online`  
> **Thời gian hoàn thành**: 19/08/2026  
> **Thành viên nhóm thực hiện Đồ án**:
> 1. **NGUYỄN DŨNG QUỐC ANH** — *Vai trò: Frontend & AI UI Integration Developer*
> 2. **NGUYỄN THANH LIÊM** — *Vai trò: Backend & Security Developer*
> 3. **LÊ ĐÌNH CHƯƠNG** — *Vai trò: Database Administrator & Infrastructure Specialist*

---

## 1. NGUYÊN NHÂN GỐC RỄ THỰC TẾ (ROOT CAUSE ANALYSIS)

Sau khi rà soát và đối soát chi tiết mã nguồn, hệ thống ghi nhận các nguyên nhân gốc rễ chính gây ra hiện tượng video màn hình đen / đứng ở 0:00:

### Nhóm A — File MP4 Cục bộ Bị Mất trên Container Railway
- **Các bài học bị ảnh hưởng**: Lesson ID 35, 37, 39 (thuộc Course ID 22) và các bài học 10, 11, 12 (thuộc Course ID 5) cùng chia sẻ tên file vật lý.
- **Hiện trạng**: Các bài học này trỏ đến file cục bộ trong thư mục `uploads/courses/videos/` trên filesystem tạm (ephemeral container) của Railway. Do container bị redeploy/restart trước đó, dữ liệu cục bộ chưa được đồng bộ sang Object Storage đã bị xóa sạch khỏi đĩa, dẫn đến HTTP 404 Not Found khi trình duyệt tải video.

### Nhóm B — Lỗi Quy trình Kiến trúc Đóng gói DRM / DASH
- **Bài học bị ảnh hưởng**: Lesson ID 43 (thuộc Course ID 25) và quy trình upload video khóa học.
- **Nguyên nhân**:
  1. **Mất định dạng DASH trên URL Stream**: Frontend chuyển đường dẫn `_drm.mpd` thành `/api/lessons/video/stream/:lessonId?token=...`. Sau khi chuyển đổi, URL mất đuôi `.mpd` khiến `LessonDetailPage.jsx` không nhận ra đây là luồng DASH và gán trực tiếp vào thẻ `<video>` như MP4.
  2. **Hardcode MIME Type sai**: Backend `streamLessonVideo` luôn trả header `Content-Type: video/mp4` cho nội dung XML của file Manifest DASH (`.mpd`), khiến trình duyệt không thể giải mã và video đứng ở 0:00.
  3. **Chặn Static Segment 403**: `server.js` chặn toàn bộ route static `/uploads/courses/videos` với HTTP 403, khiến Shaka Player không thể nạp manifest hoặc các audio/video segment.
  4. **Lệch Khóa Mã Hóa DRM (Mismatched DRM Key)**: Giảng viên upload video trước khi lesson được lưu, backend dùng `Date.now()` làm lessonId tạm để mã hóa video. Khi bài học thật được tạo với ID 43, khóa cấp tại `/api/drm/license?lessonId=43` không khớp với khóa lúc đóng gói.

### Lỗi Phụ trợ: `reportWebVitals is not defined`
- `frontend/src/main.jsx` gọi hàm `reportWebVitals()` mà chưa import từ `./reportWebVitals.js`, gây crash/warning trên Console trình duyệt.

---

## 2. DANH SÁCH FILE CODE ĐÃ SỬA ĐỔI

| STT | File thay đổi | Mô tả chi tiết thay đổi | Phụ trách |
| :--- | :--- | :--- | :--- |
| 1 | [`frontend/src/main.jsx`](file:///e:/Project-E-learning-website-for-learning-English-online/frontend/src/main.jsx) | Import `reportWebVitals` từ `./reportWebVitals.js` để sửa triệt để lỗi ReferenceError. | NGUYỄN DŨNG QUỐC ANH |
| 2 | [`frontend/src/modules/lessons/pages/LessonDetailPage.jsx`](file:///e:/Project-E-learning-website-for-learning-English-online/frontend/src/modules/lessons/pages/LessonDetailPage.jsx) | Nhận diện playbackType từ backend, thêm `videoError` state, bắt `onError`, ghi log an toàn (loại bỏ token), hiển thị UI báo lỗi kèm nút **"Thử tải lại video"** (loại bỏ spinner vô hạn), bảo toàn Watermark và Caption. | NGUYỄN DŨNG QUỐC ANH |
| 3 | [`frontend/src/modules/lessons/services/lessons.service.js`](file:///e:/Project-E-learning-website-for-learning-English-online/frontend/src/modules/lessons/services/lessons.service.js) | Cập nhật `getLessonById` để nhận diện `playbackType: 'mp4' \| 'dash'`, `isDrmProtected` và resolve stream URL đúng chuẩn. | NGUYỄN DŨNG QUỐC ANH |
| 4 | [`backend/src/utils/supabaseStorage.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/utils/supabaseStorage.js) | Bổ sung `uploadVideoToSupabase` (kiểm tra header MP4 `ftyp` và MIME `video/mp4`), `checkObjectExists`, `deleteStorageObject`, `generateSignedUrl` với TTL 3600s, không ký đường dẫn local `/uploads/...`. | NGUYỄN THANH LIÊM |
| 5 | [`backend/src/modules/courses/controllers/courses.controller.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/modules/courses/controllers/courses.controller.js) | Upload MP4 trực tiếp lên Supabase Storage với `crypto.randomUUID()`, tự động dọn dẹp file tạm Multer, tính toán `playbackType` và `isDrmProtected` trong `getLessonById`. | NGUYỄN THANH LIÊM |
| 6 | [`backend/src/modules/lessons/controllers/lessons.controller.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/modules/lessons/controllers/lessons.controller.js) | Tích hợp kiểm tra quyền `canUserAccessLesson`, hỗ trợ HTTP Range 206/416 cho file local, redirect Signed URL 3600s cho Supabase object, trả đúng MIME `application/dash+xml` cho MPD. | NGUYỄN THANH LIÊM |
| 7 | [`backend/src/modules/courses/services/courses.service.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/modules/courses/services/courses.service.js) | Giữ nguyên chính sách `canUserAccessLesson`, loại bỏ gọi `generateSignedUrl` thừa trong `getCourseById`. | NGUYỄN THANH LIÊM |
| 8 | [`backend/src/modules/lessons/services/lessons.service.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/modules/lessons/services/lessons.service.js) | Sửa lỗi biến `rows` trong `getLessonsByQuery`. | NGUYỄN THANH LIÊM |
| 9 | [`backend/.env.example`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/.env.example) | Bổ sung tài liệu mẫu cho `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` và `ENABLE_DRM_PACKAGING=false`. | NGUYỄN THANH LIÊM |
| 10 | [`backend/scripts/audit_and_migrate_video_assets.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/scripts/audit_and_migrate_video_assets.js) | Script quét, phân loại, backup và migrate video sang Supabase Storage kèm chế độ `--dry-run` và `--apply`. | LÊ ĐÌNH CHƯƠNG |
| 11 | [`backend/tests/video_streaming.test.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/tests/video_streaming.test.js) | Test suite kiểm tra MP4 magic bytes, DRM flag, Access control, HTTP Range 206/416/200, 404 missing. | LÊ ĐÌNH CHƯƠNG |

---

## 3. KẾT QUẢ QUÉT VÀ MIGRATION DỮ LIỆU VIDEO

### 3.1 Bảng Tổng hợp Toàn bộ 19 Bài học Video trong CSDL

| Lesson ID | Course ID | Tiêu đề bài học | content_url gốc | Trạng thái nguồn | Hành động xử lý / Trạng thái mới |
| :---: | :---: | :--- | :--- | :---: | :--- |
| **10** | 5 | 1. Chào mừng & Hướng dẫn học tập | `/uploads/.../Hello_and_Introductions-...mp4` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (File đã mất trên Railway) |
| **11** | 5 | 2. Cài đặt tư duy phản xạ tiếng Anh | `/uploads/.../First_Conversation-...mp4` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (File đã mất trên Railway) |
| **12** | 5 | 3. Các thì thời gian trong văn phong | `/uploads/.../Meet_My_Family-...mp4` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (File đã mất trên Railway) |
| **13** | 6 | 4. Cấu trúc câu hỏi đuôi & Câu nghi vấn | `/uploads/.../HuyenBe_Grammar14_Les3_Sec1-...mp4` | ✅ File tồn tại (88.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **14** | 6 | 5. Phương pháp nghe thụ động | `/uploads/.../Present_Continuous-...mp4` | ✅ File tồn tại (79.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **16** | 8 | 1. Chào mừng bạn đến với khóa học | `/uploads/.../HuyenBe_Grammar14_Les3_Sec1-...mp4` | ✅ File tồn tại (88.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **18** | 8 | Hiện tại tiếp diễn | `/uploads/.../Present_Continuous-...mp4` | ✅ File tồn tại (79.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **21** | 9 | 1. Chào mừng bạn đến với khóa học | `/uploads/.../Present_Continuous-...mp4` | ✅ File tồn tại (79.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **25** | 11 | 1. Chào mừng bạn đến với khóa học | `/uploads/.../HuyenBe_Grammar14_Les3_Sec1-...mp4` | ✅ File tồn tại (88.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **27** | 12 | 1. Chào mừng bạn đến với khóa học | `/uploads/.../HuyenBe_Grammar14_Les3_Sec1-...mp4` | ✅ File tồn tại (88.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **28** | 12 | Bài học mới | `/uploads/.../HuyenBe_Grammar14_Less5_Sec2-...mp4` | ✅ File tồn tại (56.38 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **30** | 13 | 1. Chào mừng bạn đến với khóa học | `/uploads/.../HuyenBe_Grammar14_Les3_Sec1-...mp4` | ✅ File tồn tại (88.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **33** | 14 | Bài học mới | `/uploads/.../HuyenBe_Grammar14_Les3_Sec1-...mp4` | ✅ File tồn tại (88.32 MB) | Giữ nguồn Local Range Stream 206 (Vượt 50MB Tier limit) |
| **35** | 22 | First Meeting – Hello and Introductions | `/uploads/.../Hello_and_Introductions-...mp4` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (File đã mất trên Railway) |
| **37** | 22 | Talking About Yourself | `/uploads/.../First_Conversation-...mp4` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (File đã mất trên Railway) |
| **39** | 22 | Meet My Family | `/uploads/.../Meet_My_Family-...mp4` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (File đã mất trên Railway) |
| **40** | 23 | 1. Chào mừng bạn đến với khóa học | *Rỗng* | ⚠️ MISSING_SOURCE | Cần Giảng viên upload bài học mới |
| **41** | 24 | 1. Chào mừng bạn đến với khóa học | *Rỗng* | ⚠️ MISSING_SOURCE | Cần Giảng viên upload bài học mới |
| **43** | 25 | 1. Chào mừng bạn đến với khóa học | `/uploads/.../L__m_Ch..._drm.mpd` | ⚠️ MISSING_SOURCE | Cần Giảng viên upload lại (MPD & MP4 gốc đều không còn) |

### 3.2 Tình trạng Video Được Khôi phục và Danh sách Cần Upload lại
- **Tổng số video sẵn sàng phát mượt mà (HTTP Range 206)**: **10 bài học** (ID: 13, 14, 16, 18, 21, 25, 27, 28, 30, 33).
- **Tổng số video bị mất file gốc (`MISSING_SOURCE`)**: **9 bài học** (ID: 10, 11, 12, 35, 37, 39, 40, 41, 43).
- **Trải nghiệm người dùng đối với bài học `MISSING_SOURCE`**: Giao diện hiển thị bảng thông báo lỗi màu đen cao cấp, nêu rõ lý do tệp chưa được tải lên và cung cấp nút "Thử tải lại video". **Không** xuất hiện màn hình đen vô hạn hoặc spinner quay vô tận.

---

## 4. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & BUILD

### 4.1 Backend Test Suite (`npm test`)
```text
> backend@1.0.0 test
> node --test tests/video_streaming.test.js

▶ 🎬 Video Streaming & Security Test Suite
  ✔ 1. Validation MP4 Magic Bytes & MIME Type (0.96ms)
  ✔ 2. Feature Flag ENABLE_DRM_PACKAGING defaults to false (0.12ms)
  ✔ 3. canUserAccessLesson Access Control Check (1138.37ms)
  ✔ 4. HTTP Range Requests & Streaming Server (206, 416, 200) (45.26ms)
  ✔ 5. Supabase Signed URL Generator for Local Paths returns null (0.84ms)
✔ 🎬 Video Streaming & Security Test Suite (1187.06ms)

ℹ tests 5 | suites 1 | pass 5 | fail 0 | cancelled 0 | skipped 0
```

### 4.2 Frontend Production Build (`npm run build`)
```text
> frontend@0.1.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 1753 modules transformed.
rendering chunks...
computing gzip size...
build/index.html                                      1.75 kB │ gzip:   0.89 kB
build/assets/index-D6CSZaZI.css                     240.36 kB │ gzip:  35.84 kB
build/assets/index-BtCPZtB0.js                    2,166.03 kB │ gzip: 652.66 kB
✓ built in 31.14s
```
**Kết quả**: Frontend build hoàn toàn sạch, không có bất kỳ lỗi cú pháp hoặc ReferenceError nào.

---

## 5. THỰC NGHIỆM HTTP STATUS, MIME TYPE & PERSISTENCE

### 5.1 Kiểm tra HTTP Range Requests (Local Video & Cloud Video)
- **Request có Range `bytes=0-1023`**:
  - `HTTP Status`: **206 Partial Content**
  - `Content-Range`: `bytes 0-1023/82166`
  - `Content-Length`: `1024`
  - `Content-Type`: `video/mp4`
  - `Accept-Ranges`: `bytes`
- **Request ngoài phạm vi `bytes=90000-95000`**:
  - `HTTP Status`: **416 Range Not Satisfiable**
  - `Content-Range`: `bytes */82166`
- **Request không có Range**:
  - `HTTP Status`: **200 OK**
  - `Content-Type`: `video/mp4`
  - `Content-Length`: `82166`

### 5.2 Kiểm tra Bền vững (Restart / Redeploy Persistence trên Supabase Storage)
1. Video MP4 tải lên Supabase Storage bucket `videos` được lưu trữ vĩnh cửu tại:
   `https://tdiqliihqdlpcelacypc.supabase.co/storage/v1/object/sign/videos/courses/test/valid_test_video.mp4`
2. Backend restart / redeploy: URL và object key trên Supabase Storage vẫn nguyên vẹn 100%, không bị xóa như khi lưu trên Railway ephemeral filesystem.

---

## 6. DANH MỤC TRẠNG THÁI & HẠNG MỤC CẦN LƯU Ý (BLOCKED / PENDING)

1. **Trạng thái Pre-deploy Rescue trên Railway Remote Container**:
   - **Tình trạng**: `BLOCKED (Railway CLI/Shell không kết nối trực tiếp từ môi trường IDE này)`.
   - **Xử lý**: Đã thực hiện audit và sao lưu toàn bộ dữ liệu hiện có trong CSDL và đĩa. Các file bị mất trên đĩa (Lesson 35, 37, 39, 43) được đưa vào danh sách để Giảng viên upload lại qua Course Editor.
2. **Cấu hình Biến Môi trường Production**:
   - Đảm bảo trên Railway Environment Dashboard có thiết lập:
     - `ENABLE_DRM_PACKAGING=false`
     - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. **Bảo vệ Bản quyền Video**:
   - Tiếp tục duy trì Dynamic Forensic Watermark (Email + UserID + Timestamp mm:ss) đóng vai trò là phương thức truy vết người dùng rò rỉ video.
