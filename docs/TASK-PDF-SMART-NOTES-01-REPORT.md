# BÁO CÁO KỸ THUẬT: PDF HIGHLIGHT & PERSONAL SMART NOTES (TASK-PDF-SMART-NOTES-01)

> **Mã công việc**: `TASK-PDF-SMART-NOTES-01`  
> **Nhánh thực hiện**: `feature/pdf-smart-notes`  
> **Base Commit SHA audit**: `75b80653005f6f7fcccdf4c1b3f0b7dcbd762e6c`  
> **Thời gian thực hiện**: 19/08/2026  
> **Người phụ trách task**: **NGUYỄN DŨNG QUỐC ANH** (*Frontend & AI UI Integration Developer*)  
> **Hỗ trợ triển khai và kiểm thử mã nguồn**: **AI Agent**  
> **Trạng thái kiểm định**: **AUTOMATED VERIFICATION PASSED**

---

## 1. TỔNG QUAN HỆ THỐNG & KẾT QUẢ KIỂM ĐỊNH

| Hạng mục kiểm thử | Trạng thái | Chi tiết / Lý do |
| :--- | :---: | :--- |
| **Backend Automated Tests (`npm test`)** | **PASSED (33/33)** | 9 PDF Notes tests + 19 Speaking tests + 5 Video Streaming tests (100% offline, 0 failed) |
| **Frontend Automated Tests (`npm run test:speaking`)** | **PASSED (27/27)** | 13 `pdfNotes` + 5 `SpeakingExercise` + 4 `useAudioRecorder` + 5 `chatbotAudioService` |
| **Frontend Production Build (`npm run build`)** | **PASSED** | 1792 modules transformed, built in 11.69s (0 errors) |
| **Code Linting** | **NOT_RUN** | Dự án không cấu hình script lint trong `package.json` |
| **Railway Deployment** | **NOT_VERIFIED** | Cần kiểm tra migration và API trên môi trường Railway sau khi deploy |
| **Vercel Deployment** | **NOT_VERIFIED** | Cần kiểm tra giao diện PDF.js worker trên domain Vercel sau khi deploy |

---

## 2. KIẾN TRÚC & CÁC TÍNH NĂNG ĐÃ TRIỂN KHAI

### 2.1. Thay thế `<iframe>` bằng `PdfStudyViewer.jsx` (react-pdf / PDF.js)
- Loại bỏ hoàn toàn nhược điểm của `<iframe>` (bị cô lập bởi Same-Origin Sandbox, không thể bôi đen văn bản và không thể vẽ lớp phủ highlight).
- Xây dựng component chuyên dụng **`PdfStudyViewer.jsx`** tích hợp `react-pdf`:
  - Hỗ trợ chuyển trang (`Prev`/`Next`/nhảy trang) và chế độ xem linh hoạt (Từng trang hoặc Cuộn liên tục).
  - Zoom tùy chỉnh từ 75% đến 200%, nút Khớp chiều rộng (*Fit Width*).
  - Tích hợp lớp bảo mật: Forensic Watermark động (Email + UserID xoay vòng mỗi 25s), chống in ấn và ẩn thanh download mặc định.
  - Tùy biến CSS `user-select: text !important` cho Text Layer để người học bôi đen chữ mượt mà.

### 2.2. Bắt sự kiện Text Selection & Chuẩn hóa Tọa độ (Normalized Rects $0.0 - 1.0$)
- Khi người dùng bôi đen văn bản trong tài liệu PDF:
  - Bắt sự kiện `mouseup`/`touchend` $\rightarrow$ Lấy `Selection` và `Range.getClientRects()`.
  - Tính toán chuyển đổi tọa độ pixel sang tỷ lệ phần trăm $(0 \le \text{val} \le 1)$ tương đối theo kích thước trang PDF:
    $$\text{x} = \frac{\text{rect.left} - \text{pageRect.left}}{\text{pageRect.width}}, \quad \text{y} = \frac{\text{rect.top} - \text{pageRect.top}}{\text{pageRect.height}}$$
  - Đảm bảo vùng highlight hiển thị chính xác 100%, không bị lệch khi zoom, thay đổi kích thước cửa sổ hoặc xoay thiết bị di động.

### 2.3. Thanh công cụ nổi chọn màu & loại ghi chú (`PdfSelectionPopover.jsx`)
- Hiển thị popover thông minh cạnh vùng chọn:
  - Chọn 4 màu highlight: **Vàng** (Yellow), **Xanh lá** (Green), **Xanh dương** (Blue), **Hồng** (Pink).
  - Phân loại 4 nhóm ghi chú: **Quan trọng** (`important`), **Chưa hiểu** (`not_understood`), **Cần xem lại** (`review`), **Từ vựng** (`vocabulary`).
  - Ô nhập ghi chú giải thích/câu hỏi cá nhân (tối đa 2000 ký tự).
  - Đóng khi bấm `Escape` hoặc click ra ngoài.

### 2.4. Sidebar Tab Ghi chú (`PdfNotesPanel.jsx`) & Điều hướng 2 chiều
- Khi bài học là PDF:
  - Sidebar hiển thị đúng 3 tab: **Bài học**, **Ghi chú**, **AI Chat** (tự động ẩn tab *Phụ đề AI*).
- Tab **Ghi chú**:
  - Nhóm ghi chú theo số trang (Trang 1, Trang 2,...).
  - Tìm kiếm nội dung nhanh theo từ khóa.
  - Bộ lọc đa chiều: Theo loại ghi chú, màu sắc và trang.
  - Hỗ trợ chỉnh sửa nội dung/loại/màu sắc và xóa ghi chú trực tiếp.
  - **Điều hướng 2 chiều**: Nhấp vào ghi chú ở sidebar tự động chuyển trang PDF đến đúng vị trí và kích hoạt hiệu ứng nhấp nháy (Glow/Blink) trong 1.5s.

### 2.5. Cơ sở dữ liệu PostgreSQL & API Backend
- Tạo bảng `pdf_notes` và các chỉ mục `idx_pdf_notes_user_lesson_doc`, `idx_pdf_notes_user_lesson_page`.
- Cập nhật cả `schema.sql` và cơ chế tự động đồng bộ trong `backend/src/config/database.js`.
- Bốn API endpoints chuẩn RESTful:
  - `GET /api/lessons/:lessonId/pdf-notes?documentRef=...`
  - `POST /api/lessons/:lessonId/pdf-notes`
  - `PUT /api/lessons/:lessonId/pdf-notes/:noteId`
  - `DELETE /api/lessons/:lessonId/pdf-notes/:noteId`
- Bảo mật nghiêm ngặt:
  - Kiểm tra `canUserAccessLesson`.
  - Lấy `userId` từ token (`req.user.id`).
  - Cô lập dữ liệu cá nhân 100% (User A không thể xem, sửa hoặc xóa ghi chú của User B).
  - Whitelist danh mục/màu sắc, kiểm tra tọa độ $[0.0, 1.0]$, parameterized queries chống SQL Injection.

---

## 3. DANH SÁCH TỆP ĐÃ THAY ĐỔI & TẠO MỚI

| STT | File | Hành động | Nội dung thay đổi |
| :---: | :--- | :---: | :--- |
| 1 | `backend/schema.sql` | `[MODIFY]` | Thêm bảng `pdf_notes` và 2 chỉ mục |
| 2 | `backend/src/config/database.js` | `[MODIFY]` | Thêm tự động tạo bảng `pdf_notes` khi server kết nối |
| 3 | `backend/src/modules/lessons/services/pdfNotes.service.js` | `[NEW]` | Service CRUD PDF Notes, validation tọa độ và cô lập dữ liệu |
| 4 | `backend/src/modules/lessons/controllers/pdfNotes.controller.js` | `[NEW]` | Controller xử lý 4 API endpoints cho PDF Notes |
| 5 | `backend/src/modules/lessons/lessons.routes.js` | `[MODIFY]` | Gắn các routes `/api/lessons/:lessonId/pdf-notes` |
| 6 | `backend/tests/pdf_notes.test.js` | `[NEW]` | Test suite backend 9 tests (CRUD, phân quyền, cô lập user, validation) |
| 7 | `backend/package.json` | `[MODIFY]` | Cập nhật script `npm test` bao gồm `pdf_notes.test.js` |
| 8 | `frontend/package.json` | `[MODIFY]` | Cài đặt thư viện `react-pdf` v10.4.1 |
| 9 | `frontend/src/modules/lessons/services/pdfNotes.service.js` | `[NEW]` | Service frontend gọi API và lưu bản nháp `localStorage` |
| 10 | `frontend/src/modules/lessons/components/PdfSelectionPopover.jsx` | `[NEW]` | Toolbar nổi chọn màu, loại ghi chú và nhập nội dung |
| 11 | `frontend/src/modules/lessons/components/PdfHighlightOverlay.jsx` | `[NEW]` | Lớp phủ vẽ các box highlight theo tỷ lệ phần trăm |
| 12 | `frontend/src/modules/lessons/components/PdfStudyViewer.jsx` | `[NEW]` | Trình đọc PDF, zoom, phân trang, watermark và text selection |
| 13 | `frontend/src/modules/lessons/components/PdfNotesPanel.jsx` | `[NEW]` | Tab ghi chú sidebar với search, filter, edit, delete và group by page |
| 14 | `frontend/src/modules/lessons/pages/LessonDetailPage.jsx` | `[MODIFY]` | Tích hợp `PdfStudyViewer`, 3 tabs sidebar (Bài học, Ghi chú, AI Chat) |
| 15 | `frontend/tests/pdfNotes.test.jsx` | `[NEW]` | Test suite frontend 13 tests (Panel, Popover, Overlay, Service) |
| 16 | `docs/TASK-PDF-SMART-NOTES-01-REPORT.md` | `[NEW]` | Báo cáo kiểm định kỹ thuật chi tiết |
| 17 | `docs/TASK-PDF-SMART-NOTES-01-TEST-RESULTS.json` | `[NEW]` | Kết quả kiểm thử chuẩn JSON |

---

## 4. KẾT QUẢ THỰC THI KIỂM THỬ THỰC TẾ

```text
=== BACKEND (cd backend && npm test) ===
Exit Code: 0
Tests: 33 passed (9 PDF Notes + 19 Speaking + 5 Video Streaming), 0 failed
Duration: ~1.65s (100% offline, không gọi mạng)

=== FRONTEND (cd frontend && npm run test:speaking) ===
Exit Code: 0
Test Files: 4 passed (pdfNotes.test.jsx, SpeakingExercise.test.jsx, useAudioRecorder.test.js, chatbotAudioService.test.js)
Tests: 27 passed, 0 failed
Duration: ~2.37s

=== FRONTEND BUILD (cd frontend && npm run build) ===
Exit Code: 0
Output: 1792 modules transformed, built in 11.69s (0 errors)

=== WHITESPACE CHECK (git diff --check) ===
Exit Code: 0 (0 whitespace errors)
```

---

## 5. XÁC NHẬN AN TOÀN & QUY TRÌNH

- [x] Không làm hỏng hoặc can thiệp vào: Speaking, Video Streaming, Shaka Player, Phụ đề AI hay Quiz.
- [x] Không chứa bất kỳ `.env`, API key, secret hay credentials trong mã nguồn.
- [x] Chưa commit, chưa push, chưa deploy.
