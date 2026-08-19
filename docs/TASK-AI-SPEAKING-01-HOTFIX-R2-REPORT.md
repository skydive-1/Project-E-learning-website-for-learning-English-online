# BÁO CÁO KỸ THUẬT: PRE-PUSH VERIFICATION VÀ SỬA LỖI HỆ THỐNG CHẤM SPEAKING (TASK-AI-SPEAKING-01-HOTFIX-R2)

> **Mã công việc**: `TASK-AI-SPEAKING-01-HOTFIX-R2`  
> **Base Commit SHA audit**: `ccf1dce6822914e7c15d6f109a6110f655bbdf3b`  
> **Thời gian thực hiện**: 19/08/2026  
> **Người phụ trách task**: **NGUYỄN DŨNG QUỐC ANH**  
> **Hỗ trợ triển khai và kiểm thử mã nguồn**: **AI Agent**  
> **Trạng thái kiểm định**: **AUTOMATED VERIFICATION PASSED**

---

## 1. TỔNG QUAN TRẠNG THÁI HỆ THỐNG (HONEST VERIFICATION STATUS)

| Hạng mục kiểm thử | Trạng thái | Chi tiết / Lý do |
| :--- | :---: | :--- |
| **Backend Automated Tests (`npm test`)** | **PASSED (24/24)** | 19 Speaking tests + 5 Video streaming tests (100% offline, 0 failed, 0 skipped) |
| **Frontend Automated Tests (`npm run test:speaking`)** | **PASSED (14/14)** | 5 `chatbotAudioService` + 4 `useAudioRecorder` (Fake timer 120s) + 5 `SpeakingExercise` |
| **Frontend Production Build (`npm run build`)** | **PASSED** | 1753 modules transformed, PWA precache 17 entries (0 errors) |
| **Code Linting** | **NOT_RUN** | Không có lint script trong `package.json` |
| **Live Gemini Benchmark** | **NOT_VERIFIED** | `MISSING_REAL_SPEECH_FIXTURE` (fixture là tone mẫu; live test được tách biệt an toàn qua `RUN_LIVE_GEMINI_TESTS`) |
| **Railway Deployment** | **NOT_VERIFIED** | Cần cấu hình biến môi trường thủ công và kiểm tra sau khi deploy |
| **Vercel Deployment** | **NOT_VERIFIED** | Cần xác minh quyền Micro HTTPS trên domain production |
| **Real Microphone E2E** | **NOT_VERIFIED** | Cần kiểm thử ghi âm người thật trên trình duyệt sau khi deploy |

---

## 2. NGUYÊN NHÂN GỐC RỄ & CÁC THAY ĐỔI ĐÃ XÁC MINH TRONG MÃ NGUỒN

### 2.1. [P0] Đồng bộ toàn bộ Model về Gemini 3.7 Flash
- **Hiện trạng trước sửa**: Tồn tại fallback `gemini-3.5-flash-lite` rải rác khiến chuẩn chấm điểm thay đổi giữa các request.
- **Mã nguồn đã triển khai**:
  - `backend/src/utils/ai-clients.js`: Cấu hình tập trung `DEFAULT_GEMINI_SPEAKING_MODEL = "gemini-3.7-flash"`.
  - Thứ tự phân giải: `process.env.GEMINI_SPEAKING_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_SPEAKING_MODEL`.
  - Log an toàn: `[AI Speaking] Model configured: gemini-3.7-flash` (không log API key).
  - Trả về chính xác `modelUsed: "gemini-3.7-flash"` hoặc `modelUsed: null` khi pre-check silence không gọi AI.
  - Không fallback âm thầm từ 3.7 sang 3.5; ném lỗi rõ ràng nếu model lỗi.
  - Cập nhật tài liệu mẫu trong `backend/.env.example`.

### 2.2. [P0] Sửa Validator thành Strict thật sự (Zero Malformed Trust)
- **Hiện trạng trước sửa**: Validator chấp nhận dữ liệu sai (string `"true"`, `"85%"`, điểm `120` tự clamp về `100`, tự tạo feedback giả).
- **Mã nguồn đã triển khai** (`backend/src/utils/speakingValidator.js`):
  - `hasSpeech`: Bắt buộc boolean thật (`typeof val === 'boolean'`). Reject `"true"`, `"false"` dạng chuỗi.
  - Score: Bắt buộc finite number trong $[0, 100]$. Reject `"85"`, `"85%"`, `NaN`, `Infinity`, $<0$, $>100$ (không auto-clamp).
  - Khi `hasSpeech === true`: Bắt buộc đủ tất cả điểm thành phần, không mặc định thành 0, không tạo feedback tích cực giả.
  - Schema sai: Retry tối đa 1 lần; nếu vẫn sai ném HTTP 503 với mã `AI_RESPONSE_INVALID`. Không biến schema sai thành `no_speech`.

### 2.3. [P0] Sửa Upload Audio, Magic Bytes và HTTP 413
- **Hiện trạng trước sửa**: Cho phép PDF đổi tên `.mp3`; file $> 10\text{ MB}$ bị crash thành HTTP 500 do unhandled Multer exception.
- **Mã nguồn đã triển khai** (`backend/src/middleware/upload.middleware.js` & `error.middleware.js`):
  - Whitelist MIME âm thanh kết hợp kiểm tra Magic Bytes nhị phân: WAV (`RIFF`+`WAVE`), OGG (`OggS`), WebM (EBML header), MP3 (`ID3`/MPEG Sync), M4A (`ftyp`).
  - File PDF đổi tên `.mp3` bị từ chối với HTTP 400 `UNSUPPORTED_AUDIO_TYPE`.
  - File $> 10\text{ MB}$ trả về HTTP 413 `AUDIO_TOO_LARGE`.
  - Toàn bộ test integration chạy trực tiếp qua router và error middleware production chuẩn.

### 2.4. [P0] Sửa Auto-stop 120s và Bảo toàn AudioBlob
- **Hiện trạng trước sửa**: `stopRecording()` bị gọi trong state updater của `setRecordingTime`, bỏ qua Promise và mất blob.
- **Mã nguồn đã triển khai**:
  - `frontend/src/hooks/useAudioRecorder.js`: Timer độc lập, kích hoạt `handleAutoStop()` khi chạm 120s, bảo toàn `audioBlob` qua callback `onAutoStop(blob)`.
  - `frontend/src/modules/lessons/components/SpeakingExercise.jsx`: Tự động nộp bài khi đạt 120s, hiển thị thông báo, bọc kiểm tra an toàn `if (!audioBlob)`.
  - Thêm bộ test tự động `frontend/tests/useAudioRecorder.test.js` sử dụng Fake Timers chứng minh:
    - Timer 120s dừng recorder đúng một lần.
    - Không có side-effect trong state updater.
    - `audioBlob` nguyên vẹn được chuyển tới callback.
    - Bấm stop nhiều lần không submit trùng lặp.
    - Null blob không gây crash.

### 2.5. [P1] Word Alignment cho Contractions và Repeated Words
- **Hiện trạng trước sửa**: `don't` bị tách thành `don` và `t`; `occurrenceIndex` chỉ tăng khi `correct_text`, dẫn đến lệch index khi từ lặp đầu tiên bị thiếu.
- **Mã nguồn đã triển khai** (`backend/src/utils/speakingScorer.js`):
  - Giữ nguyên cấu trúc token `don't` khi tokenize (không tách đôi).
  - Tăng `occurrenceIndex` cho **mọi** lần xuất hiện trong target (`correct_text`, `missing`, `substituted`).
  - Đã kiểm tra các trường hợp từ lặp bị thiếu ở đầu, giữa và cuối câu.

---

## 3. DANH SÁCH FILE THAY ĐỔI THỰC TẾ TRONG WORKING TREE

| STT | File | Thay đổi chính |
| :---: | :--- | :--- |
| 1 | `backend/.env.example` | Cập nhật `GEMINI_MODEL=gemini-3.7-flash` và `GEMINI_SPEAKING_MODEL=gemini-3.7-flash` |
| 2 | `backend/src/utils/ai-clients.js` | Cấu hình model trung tâm `gemini-3.7-flash`, `getSpeakingModelName()`, log khởi động an toàn |
| 3 | `backend/src/utils/speakingValidator.js` | Strict validator 100%: reject string bool, reject non-numeric/out-of-range scores, `AI_RESPONSE_INVALID` |
| 4 | `backend/src/utils/speakingScorer.js` | Contraction tokenization không tách từ, occurrence index tăng cho mọi target word occurrence |
| 5 | `backend/src/middleware/upload.middleware.js` | Kiểm tra Magic Bytes nhị phân (WAV/OGG/WebM/MP3/M4A), whitelist MIME, reject PDF đổi tên |
| 6 | `backend/src/middleware/error.middleware.js` | Chuẩn hóa trả về cả `code` và `message`, xử lý `LIMIT_FILE_SIZE` $\rightarrow$ HTTP 413 `AUDIO_TOO_LARGE` |
| 7 | `backend/src/modules/chatbot/chatbot.routes.js` | Gắn `upload.verifyAudioMagicBytes` cho route `/api/chatbot/audio` |
| 8 | `backend/src/modules/chatbot/services/chatbot.service.js` | Tích hợp strict validator, retry 1 lần ném `AI_RESPONSE_INVALID` (503), modelUsed trung tâm |
| 9 | `backend/tests/speaking_assessment.test.js` | Bộ 19 tests offline (mocked AI), không tốn quota, kiểm tra toàn diện 5 nhóm yêu cầu |
| 10 | `backend/scripts/run_speaking_benchmark.js` | Benchmark runner trung thực (gating live test, runtime commit SHA) |
| 11 | `frontend/src/hooks/useAudioRecorder.js` | Sửa auto-stop 120s, bảo toàn `audioBlob`, cung cấp `onAutoStop` callback |
| 12 | `frontend/src/modules/lessons/components/SpeakingExercise.jsx` | Tích hợp `handleAutoStopCallback`, tái cấu trúc `submitEvaluation`, an toàn null blob |
| 13 | `frontend/tests/useAudioRecorder.test.js` | [NEW] Test suite kiểm tra fake timer 120s, auto-stop và bảo toàn blob |
| 14 | `frontend/tests/SpeakingExercise.test.jsx` | Bổ sung test null blob safety |

---

## 4. KẾT QUẢ THỰC THI KIỂM THỬ THỰC TẾ

```text
=== BACKEND (cd backend && npm test) ===
Exit Code: 0
Tests: 24 passed (19 Speaking tests + 5 Video tests), 0 failed, 0 skipped
Duration: ~1.75s (100% offline)

=== FRONTEND (cd frontend && npm run test:speaking) ===
Exit Code: 0
Test Files: 3 passed (chatbotAudioService.test.js, useAudioRecorder.test.js, SpeakingExercise.test.jsx)
Tests: 14 passed, 0 failed
Duration: ~1.96s

=== FRONTEND BUILD (cd frontend && npm run build) ===
Exit Code: 0
Output: 1753 modules transformed, PWA precache 17 entries generated (0 errors)

=== LINT STATUS ===
NOT_RUN (Dự án không cấu hình script lint trong package.json)
```

---

## 5. HƯỚNG DẪN CẤU HÌNH RAILWAY & CHECKLIST SAU KHI DEPLOY

### 5.1. Cấu hình biến môi trường trên Railway (Đặt thủ công)
```env
GEMINI_MODEL=gemini-3.7-flash
GEMINI_SPEAKING_MODEL=gemini-3.7-flash
GEMINI_API_KEY=your_google_ai_studio_api_key_here
ENABLE_DRM_PACKAGING=false
```

### 5.2. Checklist người dùng tự kiểm tra sau khi push và deploy
- [ ] Xác nhận Railway build thành công và log khởi động ghi: `[AI Speaking] Model configured: gemini-3.7-flash`.
- [ ] Thực hiện 1 lượt ghi âm giọng nói thật từ trình duyệt để xác nhận hiển thị 5 thanh điểm thành phần và highlight từ.
- [ ] Kiểm tra nút Voice Chatbot trên `ChatBox.jsx` phản hồi câu trả lời bình thường.
