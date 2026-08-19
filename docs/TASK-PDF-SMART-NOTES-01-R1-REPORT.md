# BÁO CÁO KỸ THUẬT: HOTFIX PDF HIGHLIGHT & PERSONAL NOTES (TASK-PDF-SMART-NOTES-01-R1)

> **Mã công việc**: `TASK-PDF-SMART-NOTES-01-R1`
> **Nhánh thực hiện**: `feature/pdf-smart-notes`
> **Base SHA audit**: `2da4f9463a5c1c6a7da4e11ec035b2221d5c33ba`
> **HEAD SHA hiện tại**: `2da4f9463a5c1c6a7da4e11ec035b2221d5c33ba`
> **Thời gian thực hiện**: 19/08/2026
> **Người phụ trách task**: **NGUYỄN DŨNG QUỐC ANH** (*Frontend & AI UI Integration Developer*)
> **Hỗ trợ triển khai và kiểm thử**: **AI Agent**
> **Trạng thái kiểm định**: **AUTOMATED & INTEGRATION VERIFICATION PASSED**

---

## 1. TỔNG HỢP NGUYÊN NHÂN GỐC & CÁCH KHẮC PHỤC

### 1.1. Lỗi Authorization PUT / DELETE & Lọc thiếu `lesson_id`
- **Nguyên nhân gốc**: Trong phiên bản trước, API PUT và DELETE chỉ kiểm tra quyền sở hữu `note_id + user_id`, chưa gọi `canUserAccessLesson` và chưa ràng buộc `lesson_id`. Dẫn đến nguy cơ người dùng đã hết hạn khóa học vẫn sửa/xóa được note, hoặc thao tác chéo giữa các `lesson_id` khác nhau.
- **Cách khắc phục**:
  - Cả 4 API (`GET`, `POST`, `PUT`, `DELETE`) đều kiểm tra đăng nhập (`req.user.id`), gọi `coursesService.canUserAccessLesson(userId, lessonId, roleId)` và trả `403 FORBIDDEN` nếu không có quyền.
  - Các truy vấn SQL `UPDATE` và `DELETE` bắt buộc lọc đồng thời `WHERE note_id = $1 AND user_id = $2 AND lesson_id = $3`. Nếu note không thuộc đúng lesson trên URL, trả `404 NOTE_NOT_FOUND`.

### 1.2. Không tin tưởng `materialId` và `documentRef` từ Frontend
- **Nguyên nhân gốc**: Backend trước đây chấp nhận `documentRef` hoặc `materialId` do client gửi lên mà không kiểm chứng sự tồn tại hoặc quyền sở hữu của file đính kèm.
- **Cách khắc phục**:
  - Hàm `resolveDocumentRef(lessonId, materialId)` tự động truy vấn `lesson_materials` và `lessons`.
  - Nếu `materialId` không thuộc đúng `lesson_id`, trả `400 INVALID_MATERIAL`.
  - Chuỗi `documentRef` được sinh hoàn toàn từ Server: `lesson:${lessonId}:primary:v${pdfVersion}` hoặc `lesson:${lessonId}:material:${materialId}:v${pdfVersion}`.

### 1.3. Định danh phiên bản tài liệu PDF ổn định (`v1`, `v2`...)
- **Nguyên nhân gốc**: Nếu giảng viên upload thay thế tệp PDF mới cho bài học, các highlight của PDF cũ có thể bị vẽ sai lệch lên PDF mới.
- **Cách khắc phục**:
  - Bổ sung cột `pdf_version INT DEFAULT 1` vào bảng `lessons` và `lesson_materials` trong cả `schema.sql` và runtime migration `backend/src/config/database.js`.
  - Khi truy vấn ghi chú cho tài liệu `v2`, chỉ trả về các ghi chú thuộc `v2`, không áp dụng các ghi chú của `v1` cũ. Hỗ trợ tương thích ngược cho note `v1` và legacy `lesson:${id}:primary`.

### 1.4. Lỗi vị trí Popover khi cuộn trang (Scroll & Zoom)
- **Nguyên nhân gốc**: Tọa độ popover tính theo `container.scrollTop` của thẻ cha ngoài cùng trong khi vùng cuộn thực tế là container bên trong.
- **Cách khắc phục**:
  - `PdfSelectionPopover.jsx` sử dụng `position: fixed` bám theo `Range.getBoundingClientRect()`.
  - Render qua React Portal vào `document.body`.
  - Tự động lật lên phía trên vùng chọn nếu sát mép dưới màn hình và clamp trong viewport. Lắng nghe `scroll` (capture phase) và `resize` để cập nhật vị trí tức thời.

### 1.5. Reset State khi đổi bài học / PDF
- **Nguyên nhân gốc**: Khi chuyển sang bài học PDF khác, số trang và ghi chú cũ chưa được reset dẫn đến lỗi cố render trang vượt quá số trang PDF mới.
- **Cách khắc phục**:
  - Reset `activePdfPage = 1`, `selectedPdfNoteId = null`, `activeGlowNoteId = null`, `numPages = null`, `selectionState = null`.
  - `onDocumentLoadSuccess` tự động clamp `currentPage = Math.min(Math.max(1, currentPage), numPages)`.

### 1.6. Đồng bộ Tab Sidebar khi chuyển PDF ↔ Video
- **Nguyên nhân gốc**: Chuyển từ PDF (tab `notes`) sang Video có thể khiến sidebar rơi vào trạng thái không có tab active hoặc render trống.
- **Cách khắc phục**:
  - Khi là PDF: nếu tab là `transcript`, tự động chuyển sang `notes`.
  - Khi là Video: nếu tab là `notes`, tự động chuyển sang `transcript`. Đảm bảo sidebar luôn có tab hiển thị hợp lệ.

### 1.7. Layout Responsive & Bỏ ép buộc `aspect-video` trên PDF
- **Nguyên nhân gốc**: Container bao bọc áp dụng class `aspect-video` của video player lên toàn bộ tài liệu PDF, gây cắt xén chiều cao đọc tài liệu.
- **Cách khắc phục**:
  - Video giữ nguyên `bg-black aspect-video`.
  - PDF chuyển sang layout đọc tài liệu chuyên dụng: `w-full min-h-[580px] lg:h-[calc(100vh-110px)] bg-slate-900`.
  - Thanh công cụ toolbar hỗ trợ responsive flex-wrap mượt mà cho mobile 360px, 390px, tablet 768px và desktop.

### 1.8. Bundle PDF.js Worker cục bộ & Lazy Loading
- **Nguyên nhân gốc**: Runtime phụ thuộc CDN `unpkg.com` có thể bị chặn bởi mạng nội bộ/tường lửa, và import PDF.js trực tiếp làm phình to main bundle ban đầu.
- **Cách khắc phục**:
  - Bundle worker cục bộ: `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`. Worker được build ra file `build/assets/pdf.worker.min-qwK7q_zL.mjs` (1.04 MB) độc lập hoàn toàn.
  - Lazy load `PdfStudyViewer` và `PdfNotesPanel` bằng `React.lazy` và bọc `React.Suspense`. Tách riêng chunk `PdfStudyViewer-D9EIDTrh.js` (480 KB), chỉ tải khi học viên mở bài học PDF.

---

## 2. BẢNG TỔNG HỢP KIỂM THỬ THỰC TẾ

| Hạng mục kiểm thử | Lệnh thực thi | Trạng thái | Chi tiết |
| :--- | :--- | :---: | :--- |
| **Backend Automated Tests** | `cd backend && npm test` | **PASSED (33/33)** | 9 PDF Notes R1 + 19 Speaking R2 + 5 Video Streaming (100% offline, 0 failures) |
| **Frontend Automated Tests** | `cd frontend && npm run test:speaking -- --run` | **PASSED (32/32)** | 18 PDF Notes R1 + 5 SpeakingExercise + 4 useAudioRecorder + 5 chatbotAudioService |
| **Frontend Production Build** | `cd frontend && npm run build` | **PASSED** | 1792 modules transformed, built in 13.39s (0 errors), worker local bundled |
| **Whitespace & Git Check** | `git diff --check` | **PASSED** | Exit Code: 0 (0 whitespace errors) |

---

## 3. DANH SÁCH FILE THAY ĐỔI

1. `backend/schema.sql`: Thêm `pdf_version INT DEFAULT 1` vào `lessons` và `lesson_materials`.
2. `backend/src/config/database.js`: Thêm auto-migration cho `pdf_version`.
3. `backend/src/modules/lessons/services/pdfNotes.service.js`: Service nâng cấp với validation tọa độ `x + width <= 1`, server `resolveDocumentRef`, strict user & lesson isolation.
4. `backend/src/modules/lessons/controllers/pdfNotes.controller.js`: Controller kiểm tra quyền `401/403` cho cả 4 API và lọc `lessonId`.
5. `backend/tests/pdf_notes.test.js`: Test suite backend 11 kịch bản kiểm thử production service logic.
6. `frontend/src/modules/lessons/components/PdfSelectionPopover.jsx`: Render Portal, `position: fixed`, viewport clamping.
7. `frontend/src/modules/lessons/components/PdfStudyViewer.jsx`: Worker bundle cục bộ, dynamic fit width, retry key, empty state, continuous mode observer.
8. `frontend/src/modules/lessons/pages/LessonDetailPage.jsx`: Lazy loading, container responsive riêng cho PDF, đồng bộ 2 chiều sidebar tab.
9. `frontend/tests/pdfNotes.test.jsx`: Test suite frontend 18 tests kiểm tra toàn diện components và service.

---

## 4. XÁC NHẬN AN TOÀN & QUY TRÌNH

- [x] Không can thiệp vào: Speaking Assessment, Gemini Model, Audio Magic Bytes, Video DRM, Shaka Player hay Quiz.
- [x] Không chứa file `.env`, credentials hay API key trong mã nguồn.
- [x] `git diff --check` đạt exit code 0.
- [x] **CHƯA commit, CHƯA push, CHƯA deploy** theo đúng yêu cầu.
