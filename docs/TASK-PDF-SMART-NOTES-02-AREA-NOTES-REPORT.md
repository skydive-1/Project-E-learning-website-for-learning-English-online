# BÁO CÁO KỸ THUẬT: NÚT “THÊM GHI CHÚ” VÀ GHI CHÚ THEO VÙNG (TASK-PDF-SMART-NOTES-02)

> **Mã công việc**: `TASK-PDF-SMART-NOTES-02`  
> **Nhánh thực hiện**: `feature/pdf-smart-notes`  
> **Base SHA audit**: `7e872fdacd9566169f90a5fade4010e5ad45535c`  
> **HEAD SHA hiện tại**: `7e872fdacd9566169f90a5fade4010e5ad45535c`  
> **Thời gian thực hiện**: 19/08/2026  
> **Người phụ trách task**: **NGUYỄN DŨNG QUỐC ANH** (*Frontend & AI UI Integration Developer*)  
> **Hỗ trợ triển khai và kiểm thử**: **AI Agent**  
> **Trạng thái kiểm định**: **ALL AUTOMATED TESTS & PRODUCTION BUILD PASSED (0 FAILURES)**

---

## 1. NGUYÊN NHÂN GỐC & MỤC TIÊU CẢI TIẾN

### 1.1. Hạn chế của cơ chế cũ
- Trước đây, hệ thống PDF Smart Notes chỉ hỗ trợ ghi chú bằng cách bôi đen text layer (`selection_type = 'text'`).
- Đối với PDF scan, PDF slide/infographic dạng ảnh hoặc tài liệu bị lỗi text layer, người dùng không thể bôi đen chữ và không có cách nào tạo ghi chú.
- Giao diện thiếu nút thao tác trực quan, chỉ hiển thị dòng gợi ý nhỏ khiến người dùng lúng túng khi gặp tài liệu không có text layer.

### 1.2. Giải pháp triển khai
- Hỗ trợ cơ chế kép (Dual Mode):
  1. **Bôi đen văn bản (`selection_type = 'text'`)**: Giữ nguyên cho tài liệu PDF có text layer thông thường.
  2. **Khoanh vùng trực quan (`selection_type = 'area'`)**: Thêm nút nổi bật **"＋ Thêm ghi chú"** ở cả Toolbar PDF, Header tab ghi chú và Empty State. Khi nhấn, bật chế độ `crosshair`, cho phép kéo thả chuột/touch để khoanh bất kỳ vùng nào trên PDF và nhập ghi chú.
- Không phụ thuộc OCR hay AI nhận diện ảnh tốn chi phí; tọa độ hình chữ nhật được chuẩn hóa tương đối theo trang `[0.0, 1.0]` chống lệch khi zoom hay đổi kích thước màn hình.

---

## 2. THIẾT KẾ KIẾN TRÚC & DATA MODEL

### 2.1. Thay đổi Database Migration (`pdf_notes`)
```sql
-- Thêm cột phân loại vùng chọn
ALTER TABLE pdf_notes 
ADD COLUMN IF NOT EXISTS selection_type VARCHAR(20) NOT NULL DEFAULT 'text';

-- Cho phép selected_text là NULL đối với ghi chú vùng (area note)
ALTER TABLE pdf_notes 
ALTER COLUMN selected_text DROP NOT NULL;
```
- Dữ liệu cũ tự động mang giá trị `selection_type = 'text'`, đảm bảo 100% tương thích ngược và idempotent.
- Cập nhật đồng bộ trong `backend/schema.sql` và runtime migration `backend/src/config/database.js`.

### 2.2. API Contract & Validation
- **POST `/api/lessons/:lessonId/pdf-notes`**:
  - `selectionType`: `'text' | 'area'` (mặc định: `'text'`).
  - Nếu `selectionType === 'area'`: `noteText` là bắt buộc (không được để trống), `selectedText` có thể là `null` hoặc chuỗi mô tả.
  - Nếu `selectionType === 'text'`: `selectedText` bắt buộc phải có nội dung.
  - Tọa độ chuẩn hóa `rects`: $0 \le x, y \le 1$, $width > 0, height > 0$, $x + width \le 1$, $y + height \le 1$.
  - Loại bỏ các vùng kéo quá nhỏ ($< 8\times 8$ px hoặc width/height $< 0.001$).
  - Server tự động xác thực và gắn phiên bản tài liệu `documentRef: lesson:<id>:primary:v<version>`.

---

## 3. CẢI TIẾN GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX)

1. **Nút "＋ Thêm ghi chú"**:
   - Xuất hiện nổi bật trên Toolbar PDF với tooltip *"Khoanh vùng trên PDF để tạo ghi chú"*, có `aria-label` và `aria-pressed={isAreaSelectionMode}`.
   - Xuất hiện tại đầu Panel Ghi chú và Empty State khi chưa có ghi chú nào.
2. **Chế độ khoanh vùng (Area Selection Mode)**:
   - Con trỏ chuyển thành `crosshair`, text layer bị vô hiệu hóa tạm thời để tránh kéo nhầm chữ.
   - Hiển thị thanh thông báo nổi: *"Kéo chuột để khoanh vùng cần ghi chú trên PDF • Nhấn Esc để hủy"*.
   - Hiển thị khung chữ nhật kéo live trong suốt với viền màu indigo sắc nét.
   - Hỗ trợ phím `Esc` để hủy chế độ tức thì.
3. **Popover nhập ghi chú (`PdfSelectionPopover.jsx`)**:
   - Đối với Area Note: Hiển thị badge *"Vùng đã chọn • Trang {pageNumber}"*, yêu cầu nhập nội dung ghi chú và giữ lại draft nếu lưu lỗi.
   - Đối với Text Note: Hiển thị trích dẫn đoạn text bôi đen trong ngoặc kép.
4. **Highlight trên trang PDF (`PdfHighlightOverlay.jsx`)**:
   - Area Note: Hiển thị viền nét đứt (dashed border) `border: 2px dashed ...` với bo góc mềm mại, độ trong suốt vừa phải để người dùng vẫn đọc được tài liệu bên dưới.
5. **Danh sách ghi chú Sidebar (`PdfNotesPanel.jsx`)**:
   - Area Note: Hiển thị tiêu đề rõ ràng *"Ghi chú vùng • Trang {pageNumber}"* kèm icon phân biệt, không render `"null"` hay `"undefined"`.
   - Tìm kiếm và lọc theo loại/màu sắc hoạt động trơn tru cho cả 2 loại ghi chú.

---

## 4. KẾT QUẢ KIỂM THỬ THỰC TẾ

| Bộ kiểm thử | Lệnh thực thi | Trạng thái | Chi tiết kết quả |
| :--- | :--- | :---: | :--- |
| **Backend Automated Tests** | `cd backend && npm test` | **PASSED (37/37)** | 13 PDF Area/Text Notes + 19 AI Speaking + 5 Video Streaming (100% offline) |
| **Frontend Automated Tests** | `cd frontend && npm run test:speaking -- --run` | **PASSED (29/29)** | 15 PDF Area Notes & Components + 5 SpeakingExercise + 4 useAudioRecorder + 5 chatbotAudioService |
| **Frontend Production Build** | `cd frontend && npm run build` | **PASSED** | 1792 modules transformed, build thành công trong 13.32s, worker bundle cục bộ 1.04 MB |
| **Whitespace & Format Check** | `git diff --check` | **PASSED** | Exit code: 0 (Không có trailing whitespace hay lỗi format) |

---

## 5. DANH SÁCH FILE ĐÃ THAY ĐỔI

1. `backend/schema.sql`: Bổ sung `selection_type` và cho phép `selected_text NULL` cho `pdf_notes`.
2. `backend/src/config/database.js`: Thêm auto-migration cho `selection_type` và `selected_text DROP NOT NULL`.
3. `backend/src/modules/lessons/services/pdfNotes.service.js`: Hỗ trợ validation và CRUD cho cả `text` và `area` notes.
4. `backend/src/modules/lessons/controllers/pdfNotes.controller.js`: Validation endpoint POST nhận `selectionType`.
5. `backend/tests/pdf_notes.test.js`: Thêm các test case kiểm tra tạo/đọc/từ chối area notes & text notes.
6. `frontend/src/modules/lessons/components/PdfSelectionPopover.jsx`: Hỗ trợ chế độ area popover, validation noteText và error retention.
7. `frontend/src/modules/lessons/components/PdfHighlightOverlay.jsx`: Render viền nét đứt cho area notes.
8. `frontend/src/modules/lessons/components/PdfNotesPanel.jsx`: Nút "＋ Thêm ghi chú", render area notes không leak null, empty state chuẩn.
9. `frontend/src/modules/lessons/components/PdfStudyViewer.jsx`: Cơ chế khoanh vùng area selection kéo thả pointer, banner hướng dẫn, phím Esc.
10. `frontend/src/modules/lessons/pages/LessonDetailPage.jsx`: Kết nối state `isAreaSelectionMode` giữa toolbar và panel ghi chú.
11. `frontend/tests/pdfNotes.test.jsx`: Bộ 15 tests frontend kiểm tra toàn diện Area Selection và UI components.

---

## 6. XÁC NHẬN AN TOÀN

- [x] Không can thiệp vào: Speaking Assessment, Gemini AI Model, Audio Magic Bytes, DRM Packaging hay Quiz.
- [x] Không đưa PDF.js Worker trở lại CDN ngoài.
- [x] Không có file `.env`, credentials hay tệp rác trong git.
- [x] **CHƯA commit, CHƯA push, CHƯA deploy** theo đúng yêu cầu.
