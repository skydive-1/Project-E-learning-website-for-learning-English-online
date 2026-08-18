# DANH MỤC LỖI & THEO DÕI XỬ LÝ (FRONTEND BUG TRACKING LIST)
## [TASK-FE-TEST-01] SPRINT 11 DEFECT LOG & HANDOFF PROTOCOL

* **Dự án:** Website Học Tiếng Anh Trực Tuyến Tích Hợp Trợ Lý AI (**E-Learn Academy**)
* **Giai đoạn:** Sprint 11 (Code Freeze & UAT Protocol)
* **Kỹ sư phụ trách:** **NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)**
* **Cập nhật:** 2026-08-18T14:22:56.984Z

---

### 1. NGUYÊN TẮC PHÂN LOẠI MỨC ĐỘ LỖI (SEVERITY MATRIX)

* **P0 — Blocker / Critical Crash:** Ứng dụng bị sập, xuất hiện màn hình trắng (White screen), hoặc không thể truy cập các luồng chính.
* **P1 — High Severity:** Tính năng chính bị hỏng hoặc luồng người dùng bị gián đoạn, ảnh hưởng trực tiếp đến trải nghiệm học tập.
* **P2 — Medium Severity:** Lỗi giao diện nhỏ (Visual glitch), khoảng cách lề không đồng đều, hoặc thông báo chưa tối ưu nhưng không chặn luồng thao tác.
* **P3 — Low / Polish:** Các tinh chỉnh nhẹ về thẩm mỹ, hiệu ứng vi tương tác (Micro-animations).

---

### 2. DANH SÁCH LỖI ĐÃ PHÁT HIỆN & XỬ LÝ (RESOLVED DEFECTS - 100% RESOLVED)

| Bug ID | Mức Độ | Mô-đun & Tệp Ảnh Hưởng | Mô Tả Lỗi (Defect Description) | Nguyên Nhân Gốc (Root Cause) | Hành Động Xử Lý & Khắc Phục (Resolution) | Trạng Thái |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **BUG-01** | **P0** | `frontend/src/App.jsx` | Lỗi thiếu `PlayQuizPage` và `ErrorBoundary` trong tệp `App.jsx` khiến ứng dụng không render được khi truy cập route trắc nghiệm. | Quá trình cập nhật cấu hình PWA trước đó làm mất dòng import component. | Đã bổ sung lại đầy đủ `import PlayQuizPage` và `import ErrorBoundary` vào `App.jsx`. | 🟢 **ĐÃ SỬA & VERIFIED** |
| **BUG-02** | **P1** | `frontend/src/components/common/GlobalChatbot.css` | Nút kích hoạt Chatbot nổi bị che khuất hoặc đè lên thanh Bottom Navigation trên màn hình di động (<768px). | Thuộc tính `bottom: 16px` trên mobile khiến nút chatbot nằm cùng tọa độ với thanh điều hướng đáy. | Nâng cao vị trí nút chatbot trên mobile lên `bottom: 80px`, đặt `z-index: 45` cao hơn thanh điều hướng. | 🟢 **ĐÃ SỬA & VERIFIED** |
| **BUG-03** | **P1** | `frontend/src/modules/lessons/pages/LessonDetailPage.jsx` | Sidebar danh sách bài học và AI Assistant bị bó hẹp chiều cao trên màn hình điện thoại khi dùng `calc(100vh - 110px)`. | Chiều cao viewport trên mobile không đủ cho thanh sidebar cuộn nội dung. | Điều chỉnh chiều cao linh hoạt cho mobile: `min-h-[520px] h-[580px] lg:h-[calc(100vh-110px)]`. | 🟢 **ĐÃ SỬA & VERIFIED** |
| **BUG-04** | **P2** | `frontend/src/index.css` | Khoảng cách dưới đáy của trang web trên iPhone có thể bị đè bởi thanh điều hướng và dải Home Bar (Dynamic Island). | Thiếu khai báo `safe-area-inset-bottom` trong stylesheet toàn cục. | Bổ sung `padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px))` và các lớp `.safe-pb`. | 🟢 **ĐÃ SỬA & VERIFIED** |

---

### 3. DANH MỤC HẠNG MỤC CẦN BÀN GIAO (HANDOFF TO TEAM MEMBERS)

> **Tuân thủ quy định phân quyền Sprint 11:** Kỹ sư Frontend không can thiệp Backend / CSDL. Các mục dưới đây được ghi nhận để bàn giao theo kế hoạch:

| Issue ID | Mức Độ | Phân Hệ Phụ Trách | Mô Tả & Bằng Chứng Ghi Nhận | Kỹ Sư Tiếp Nhận | Kế Hoạch Xử Lý |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **HO-01** | P2 | Backend / DRM | Khi máy chủ chạy không có binary `shaka-packager`, video phát ở định dạng MP4 gốc an toàn. | **NGUYỄN THANH LIÊM** (*Backend Lead*) | Duy trì cơ chế Fallback an toàn theo tài liệu DRM. |
| **HO-02** | P2 | Database / Seed | Chuẩn hóa bộ dữ liệu "Vàng" 30 ngày cho các tài khoản mẫu phục vụ buổi Demo tốt nghiệp. | **LÊ ĐÌNH CHƯƠNG** (*DB Specialist*) | Thực hiện theo task `[TASK-DB-SEED-01]` trong Sprint 11. |

---

### 4. KẾT LUẬN & TRẠNG THÁI KHÓA MÃ NGUỒN (CODE FREEZE)

* **Tổng số lỗi P0/P1 còn tồn đọng:** **0**
* **Trạng thái:** **SẴN SÀNG NGHIỆM THU & THUYẾT TRÌNH TỐT NGHIỆP**.
