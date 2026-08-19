# BÁO CÁO KỸ THUẬT: HOTFIX R3 PRODUCTION CORRECTNESS (TASK-PDF-SMART-NOTES-03)

> **Mã công việc**: `TASK-PDF-SMART-NOTES-03`<br>
> **Nhánh thực hiện**: `hotfix/pdf-smart-notes-r3`<br>
> **Base SHA audit**: `a492cd938eb88e8d5311bea2c832799a29465284`<br>
> **HEAD SHA hiện tại**: `a492cd938eb88e8d5311bea2c832799a29465284`<br>
> **Trạng thái working tree**: `DIRTY` (Mã nguồn đã sửa và kiểm định hoàn tất, chưa commit/push theo quy định)<br>
> **Thời gian thực hiện**: 19/08/2026<br>
> **Người phụ trách task**: **NGUYỄN DŨNG QUỐC ANH** (*Frontend & AI UI Integration Developer*)<br>
> **Hỗ trợ triển khai và kiểm thử**: **AI Agent**<br>
> **Trạng thái kiểm định**: **ALL AUTOMATED TESTS & PRODUCTION BUILD PASSED (0 FAILURES)**

---

## 1. NGUYÊN NHÂN GỐC & CÁC LỖI ĐÃ KHẮC PHỤC

1. **Thay PDF chưa tăng `pdf_version`**:
   - *Nguyên nhân*: Cả `lessonsService.updateLesson` và `coursesService.updateCourse` (bulk editor) cập nhật `content_url` hoặc `content_type` nhưng không tự động tăng `pdf_version`.
   - *Khắc phục*: Thêm kiểm tra so sánh với bản ghi cũ. Tăng `pdf_version = COALESCE(pdf_version, 1) + 1` khi `content_url` thay đổi (và là PDF) hoặc khi chuyển đổi qua lại giữa `pdf` và loại khác (`video`). Giữ nguyên version khi chỉ đổi title/order/transcript hoặc giữ nguyên URL.

2. **Frontend tự chế và gửi `documentRef: lesson:X:primary:v1`**:
   - *Nguyên nhân*: Frontend tự ghép chuỗi `documentRef` và gửi lên qua query/payload khiến version bị cố định hoặc client có thể giả mạo version.
   - *Khắc phục*: Xóa toàn bộ logic tự sinh chuỗi `documentRef` ở Frontend. Frontend GET/POST chỉ gửi `lessonId`, `materialId`, `pageNumber`. Server là nguồn duy nhất (Single Source of Truth) tự resolve `documentRef` chuẩn (`canonical`).

3. **Backend GET Notes tin tưởng `documentRef` do client gửi**:
   - *Nguyên nhân*: Trước đây `pdfNotes.service.getNotes` ưu tiên đọc query parameter `documentRef` từ request. Nếu client cố tình gửi `documentRef=v1` trong khi server đang ở `v2`, server vẫn trả về note cũ `v1`.
   - *Khắc phục*: `getNotes` luôn tự gọi `resolveDocumentRef()` từ database để xác định canonical `documentRef` của server và bỏ qua param `documentRef` từ client.

4. **Popover không đóng khi Scroll / Resize**:
   - *Nguyên nhân*: Popover dùng snapshot `clientRect` cũ và cố gắng reposition khi scroll dẫn đến popover bị lệch và trôi lơ lửng.
   - *Khắc phục*: Đăng ký capture scroll listener toàn cục `window.addEventListener('scroll', handleCancel, { capture: true, passive: true })` và `resize` để đóng popover ngay lập tức khi cuộn hoặc đổi kích thước màn hình.

5. **Area Selection Pointer chưa Clamp chặt**:
   - *Nguyên nhân*: Tọa độ chuột khi kéo ra ngoài khung PDF chưa được giới hạn từ đầu mà chỉ chuẩn hóa sau khi tính toán pixel width/height.
   - *Khắc phục*: Clamp `clientX` và `clientY` trực tiếp trong khoảng `[pageRect.left, pageRect.right]` và `[pageRect.top, pageRect.bottom]` ngay tại `pointerdown` và `pointermove`. Cấu hình `touch-action: none` trong area mode để tránh xung đột với cử chỉ cuộn trang trên mobile/touch.

6. **Optimistic Area Note thiếu `selectionType`**:
   - *Nguyên nhân*: Optimistic object trước đây gán mặc định chuỗi text mà không chỉ định `selectionType: 'area'` và `selectedText: null`.
   - *Khắc phục*: Bổ sung đầy đủ `selectionType` trong optimistic cache update và rollback an toàn khi API có lỗi.

7. **Database Constraint ở Runtime Migration**:
   - *Nguyên nhân*: Runtime migration chưa có constraint `CHECK (selection_type IN ('text', 'area'))` và `CHECK (pdf_version >= 1)`.
   - *Khắc phục*: Thêm DO $$ block kiểm tra và bổ sung constraint idempotently trên Postgres trong `database.js` và `schema.sql`.

8. **Điều hướng từ Sidebar tới Area Note**:
   - *Khắc phục*: Khi click ghi chú trong sidebar, viewer tự động chuyển đến đúng trang và cuộn chính xác theo tọa độ $y$ của hình chữ nhật vào trung tâm màn hình (`scrollTo top: targetTop - containerHeight/2`).

---

## 2. THAY ĐỔI DATABASE & RUNTIME MIGRATION

```sql
-- 1. Lessons & Lesson Materials
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pdf_version INT NOT NULL DEFAULT 1 CHECK (pdf_version >= 1);
UPDATE lessons SET pdf_version = 1 WHERE pdf_version IS NULL OR pdf_version < 1;

ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS pdf_version INT NOT NULL DEFAULT 1 CHECK (pdf_version >= 1);
UPDATE lesson_materials SET pdf_version = 1 WHERE pdf_version IS NULL OR pdf_version < 1;

-- 2. PDF Notes Selection Type Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pdf_notes_selection_type'
  ) THEN
    ALTER TABLE pdf_notes ADD CONSTRAINT chk_pdf_notes_selection_type CHECK (selection_type IN ('text', 'area'));
  END IF;
END $$;
```

---

## 3. KẾT QUẢ KIỂM THỬ THỰC TẾ

| Bộ kiểm thử | Lệnh thực thi | Trạng thái | Chi tiết kết quả |
| :--- | :--- | :---: | :--- |
| **Backend Automated Tests** | `cd backend && npm test` | **PASSED (41/41)** | 17 PDF Notes Versioning & CRUD + 19 AI Speaking R2 + 5 Video Streaming (100% offline) |
| **Frontend Automated Tests** | `cd frontend && npm run test:speaking -- --run` | **PASSED (30/30)** | 16 PDF Area Notes & Components + 5 SpeakingExercise + 4 useAudioRecorder + 5 chatbotAudioService |
| **Frontend Production Build** | `cd frontend && npm run build` | **PASSED** | 1792 modules transformed, built trong 13.27s (0 errors), worker bundle cục bộ `pdf.worker.min-qwK7q_zL.mjs` (1.04 MB) |
| **Whitespace Working Tree** | `git diff --check` | **PASSED** | Exit code: 0 (0 whitespace errors) |
| **Whitespace vs Base Main** | `git diff --check a492cd938eb88e8d5311bea2c832799a29465284` | **PASSED** | Exit code: 0 (0 whitespace errors) |
| **Whitespace vs Speaking Hotfix** | `git diff --check 75b80653005f6f7fcccdf4c1b3f0b7dcbd762e6c` | **PASSED** | Exit code: 0 (0 whitespace errors) |

---

## 4. DANH SÁCH FILE ĐÃ THAY ĐỔI

1. `backend/schema.sql`: Củng cố `pdf_version INT NOT NULL DEFAULT 1 CHECK (pdf_version >= 1)` và `chk_pdf_notes_selection_type`.
2. `backend/src/config/database.js`: Thêm DO $$ runtime constraint migration cho `selection_type` và `pdf_version`.
3. `backend/src/modules/lessons/services/lessons.service.js`: Thêm logic tự động tăng `pdf_version` khi đổi file PDF hoặc chuyển đổi content_type trong `updateLesson`.
4. `backend/src/modules/courses/services/courses.service.js`: Thêm logic tự động tăng `pdf_version` cho bulk curriculum editor.
5. `backend/src/modules/lessons/services/pdfNotes.service.js`: Luôn tự resolve canonical `documentRef` từ Server, bỏ qua client-forged docRef, dọn trailing whitespace.
6. `backend/src/modules/lessons/controllers/pdfNotes.controller.js`: Bỏ qua `documentRef` từ client request query.
7. `backend/tests/pdf_notes.test.js`: Bổ sung test suites cho `updateLesson`, bulk editor, canonical docRef resolution, area & text note validation (41 tests).
8. `frontend/src/modules/lessons/services/lessons.service.js`: Map chính xác `pdfVersion: Number(l.pdf_version || l.pdfVersion || 1)` cho bài học.
9. `frontend/src/modules/lessons/services/pdfNotes.service.js`: Bỏ query param `documentRef`, hỗ trợ `materialId` và dọn trailing whitespace.
10. `frontend/src/modules/lessons/pages/LessonDetailPage.jsx`: Cập nhật TanStack Query key `['pdf-notes', lessonId, materialId, pdfVersion]`, sửa optimistic update cho area note.
11. `frontend/src/modules/lessons/components/PdfSelectionPopover.jsx`: Đóng popover lập tức khi scroll hoặc resize qua capture listener.
12. `frontend/src/modules/lessons/components/PdfStudyViewer.jsx`: Clamp pointer bounds, `touch-action: none`, auto scroll rect vào center, hỗ trợ controlled/uncontrolled state.
13. `frontend/tests/pdfNotes.test.jsx`: Bổ sung test suite kiểm tra scroll dismiss, fetch không docRef, drag pointer simulation (30 tests).
14. `docs/TASK-PDF-SMART-NOTES-01-REPORT.md`: Dọn trailing whitespace.
15. `docs/TASK-PDF-SMART-NOTES-01-R1-REPORT.md`: Dọn trailing whitespace.
16. `docs/TASK-PDF-SMART-NOTES-02-AREA-NOTES-REPORT.md`: Đồng bộ commit audit `a492cd938eb88e8d5311bea2c832799a29465284` và dọn trailing whitespace.
17. `docs/TASK-PDF-SMART-NOTES-03-HOTFIX-R3-REPORT.md`: Báo cáo chi tiết kỹ thuật R3.
18. `docs/TASK-PDF-SMART-NOTES-03-HOTFIX-R3-TEST-RESULTS.json`: Kết quả kiểm định JSON.

---

## 5. RỦI RO CÒN LẠI & PHẦN CHƯA THỂ MANUAL TEST

1. **Cử chỉ đa điểm thu phóng (Pinch-to-zoom) vật lý trên iOS Safari**: Đã cấu hình `touch-action: none` trong area mode và test trên môi trường mô phỏng; tuy nhiên cần kiểm tra thao tác cảm ứng trên thiết bị phần cứng iPhone/iPad thực tế trước khi release người dùng cuối.
2. **Migration Database Concurrency trên Cloud Supabase**: Câu lệnh runtime migration sử dụng block `DO $$` an toàn và idempotent; tuy nhiên cần xác nhận kết nối mạng từ server Railway tới Supabase khi triển khai production.
