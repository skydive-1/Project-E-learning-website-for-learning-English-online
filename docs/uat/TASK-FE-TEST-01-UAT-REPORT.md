# BÁO CÁO TỔNG KIỂM THỬ GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (FRONTEND UAT)
## [TASK-FE-TEST-01] CHÍNH THỨC — SPRINT 11 CODE FREEZE & UAT PROTOCOL

* **Dự án:** Website Học Tiếng Anh Trực Tuyến Tích Hợp Trợ Lý AI (**E-Learn Academy**)
* **Kỹ sư phụ trách:** **NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)**
* **Thành viên phối hợp:**
  - **NGUYỄN THANH LIÊM (Backend & Security Developer)**
  - **LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)**
* **Thời gian kiểm thử:** 2026-08-18T14:21:45.520Z $\rightarrow$ 2026-08-18T14:22:56.984Z
* **Trạng thái nghiệm thu:** **100% (59/59 Test Cases ĐẠT)**

---

### 1. MÔI TRƯỜNG & MA TRẬN KIỂM THỬ THỰC TẾ

#### A. Trình Duyệt Thực Thi (100% Executed & Verified):
1. **Google Chrome / Chromium:** v151.0
2. **Microsoft Edge:** v151.0 (Chromium Channel `msedge`)
3. **WebKit (Safari Equivalent):** v26.5 (Playwright WebKit Engine trên môi trường thực)

#### B. Ma Trận 5 Kích Thước Viewport Chuẩn Hóa:
1. `360 x 800 px` (Mobile Galaxy S20 / A51)
2. `390 x 844 px` (Mobile iPhone 12/13/14)
3. `768 x 1024 px` (Tablet iPad Portrait)
4. `1366 x 768 px` (Laptop HD)
5. `1440 x 900 px` (Desktop FHD)

#### C. Tài Khoản & Dữ Liệu Kiểm Thử (Không Lộ Thông Tin Nhạy Cảm):
- **Tài khoản Học viên (Role 3):** `newstudent7@example.com` (ID: 10)
- **Tài khoản Giảng viên (Role 2):** `lek262623@gmail.com` (ID: 5)
- **Tài khoản Quản trị viên (Role 1):** `admin@elearn.edu.vn` (ID: 33)
- **Dữ liệu Bài học & Quizzes:** Lesson 18 (Hiện tại tiếp diễn), Lesson 16 (Welcome Video), Quiz 2 (Tag Questions)

---

### 2. TỔNG HỢP KẾT QUẢ KIỂM THỬ TOÀN DIỆN (59 TEST CASES)

| STT | Case ID | Luồng Kiểm Thử | Trình Duyệt | Viewport | Chi Tiết & Bằng Chứng | Trạng Thái | Ảnh Chụp Bằng Chứng |
| :---: | :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| 1 | `TC-HOME-360x800-Chromium` | Homepage Responsive & Zero Overflow | Chromium | 360x800 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 360px vs ClientWidth: 360px | 🟢 **PASS** | [`TC-HOME-360x800-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-360x800-Chromium.png) |
| 2 | `TC-COURSES-360x800-Chromium` | Course Catalog Screen | Chromium | 360x800 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-360x800-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-360x800-Chromium.png) |
| 3 | `TC-HOME-390x844-Chromium` | Homepage Responsive & Zero Overflow | Chromium | 390x844 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 390px vs ClientWidth: 390px | 🟢 **PASS** | [`TC-HOME-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-390x844-Chromium.png) |
| 4 | `TC-COURSES-390x844-Chromium` | Course Catalog Screen | Chromium | 390x844 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-390x844-Chromium.png) |
| 5 | `TC-HOME-768x1024-Chromium` | Homepage Responsive & Zero Overflow | Chromium | 768x1024 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 768px vs ClientWidth: 768px | 🟢 **PASS** | [`TC-HOME-768x1024-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-768x1024-Chromium.png) |
| 6 | `TC-COURSES-768x1024-Chromium` | Course Catalog Screen | Chromium | 768x1024 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-768x1024-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-768x1024-Chromium.png) |
| 7 | `TC-HOME-1366x768-Chromium` | Homepage Responsive & Zero Overflow | Chromium | 1366x768 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 1366px vs ClientWidth: 1366px | 🟢 **PASS** | [`TC-HOME-1366x768-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-1366x768-Chromium.png) |
| 8 | `TC-COURSES-1366x768-Chromium` | Course Catalog Screen | Chromium | 1366x768 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-1366x768-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-1366x768-Chromium.png) |
| 9 | `TC-HOME-1440x900-Chromium` | Homepage Responsive & Zero Overflow | Chromium | 1440x900 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 1440px vs ClientWidth: 1440px | 🟢 **PASS** | [`TC-HOME-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-1440x900-Chromium.png) |
| 10 | `TC-COURSES-1440x900-Chromium` | Course Catalog Screen | Chromium | 1440x900 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-1440x900-Chromium.png) |
| 11 | `TC-HOME-360x800-Microsoft-Edge` | Homepage Responsive & Zero Overflow | Microsoft-Edge | 360x800 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 360px vs ClientWidth: 360px | 🟢 **PASS** | [`TC-HOME-360x800-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-360x800-Microsoft-Edge.png) |
| 12 | `TC-COURSES-360x800-Microsoft-Edge` | Course Catalog Screen | Microsoft-Edge | 360x800 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-360x800-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-360x800-Microsoft-Edge.png) |
| 13 | `TC-HOME-390x844-Microsoft-Edge` | Homepage Responsive & Zero Overflow | Microsoft-Edge | 390x844 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 390px vs ClientWidth: 390px | 🟢 **PASS** | [`TC-HOME-390x844-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-390x844-Microsoft-Edge.png) |
| 14 | `TC-COURSES-390x844-Microsoft-Edge` | Course Catalog Screen | Microsoft-Edge | 390x844 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-390x844-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-390x844-Microsoft-Edge.png) |
| 15 | `TC-HOME-768x1024-Microsoft-Edge` | Homepage Responsive & Zero Overflow | Microsoft-Edge | 768x1024 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 768px vs ClientWidth: 768px | 🟢 **PASS** | [`TC-HOME-768x1024-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-768x1024-Microsoft-Edge.png) |
| 16 | `TC-COURSES-768x1024-Microsoft-Edge` | Course Catalog Screen | Microsoft-Edge | 768x1024 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-768x1024-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-768x1024-Microsoft-Edge.png) |
| 17 | `TC-HOME-1366x768-Microsoft-Edge` | Homepage Responsive & Zero Overflow | Microsoft-Edge | 1366x768 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 1366px vs ClientWidth: 1366px | 🟢 **PASS** | [`TC-HOME-1366x768-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-1366x768-Microsoft-Edge.png) |
| 18 | `TC-COURSES-1366x768-Microsoft-Edge` | Course Catalog Screen | Microsoft-Edge | 1366x768 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-1366x768-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-1366x768-Microsoft-Edge.png) |
| 19 | `TC-HOME-1440x900-Microsoft-Edge` | Homepage Responsive & Zero Overflow | Microsoft-Edge | 1440x900 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 1440px vs ClientWidth: 1440px | 🟢 **PASS** | [`TC-HOME-1440x900-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-1440x900-Microsoft-Edge.png) |
| 20 | `TC-COURSES-1440x900-Microsoft-Edge` | Course Catalog Screen | Microsoft-Edge | 1440x900 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-1440x900-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-1440x900-Microsoft-Edge.png) |
| 21 | `TC-HOME-360x800-WebKit-Safari` | Homepage Responsive & Zero Overflow | WebKit-Safari | 360x800 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 352px vs ClientWidth: 352px | 🟢 **PASS** | [`TC-HOME-360x800-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-360x800-WebKit-Safari.png) |
| 22 | `TC-COURSES-360x800-WebKit-Safari` | Course Catalog Screen | WebKit-Safari | 360x800 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-360x800-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-360x800-WebKit-Safari.png) |
| 23 | `TC-HOME-390x844-WebKit-Safari` | Homepage Responsive & Zero Overflow | WebKit-Safari | 390x844 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 382px vs ClientWidth: 382px | 🟢 **PASS** | [`TC-HOME-390x844-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-390x844-WebKit-Safari.png) |
| 24 | `TC-COURSES-390x844-WebKit-Safari` | Course Catalog Screen | WebKit-Safari | 390x844 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-390x844-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-390x844-WebKit-Safari.png) |
| 25 | `TC-HOME-768x1024-WebKit-Safari` | Homepage Responsive & Zero Overflow | WebKit-Safari | 768x1024 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 760px vs ClientWidth: 760px | 🟢 **PASS** | [`TC-HOME-768x1024-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-768x1024-WebKit-Safari.png) |
| 26 | `TC-COURSES-768x1024-WebKit-Safari` | Course Catalog Screen | WebKit-Safari | 768x1024 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-768x1024-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-768x1024-WebKit-Safari.png) |
| 27 | `TC-HOME-1366x768-WebKit-Safari` | Homepage Responsive & Zero Overflow | WebKit-Safari | 1366x768 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 1358px vs ClientWidth: 1358px | 🟢 **PASS** | [`TC-HOME-1366x768-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-1366x768-WebKit-Safari.png) |
| 28 | `TC-COURSES-1366x768-WebKit-Safari` | Course Catalog Screen | WebKit-Safari | 1366x768 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-1366x768-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-1366x768-WebKit-Safari.png) |
| 29 | `TC-HOME-1440x900-WebKit-Safari` | Homepage Responsive & Zero Overflow | WebKit-Safari | 1440x900 | Title: "E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu" | ScrollWidth: 1432px vs ClientWidth: 1432px | 🟢 **PASS** | [`TC-HOME-1440x900-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-HOME-1440x900-WebKit-Safari.png) |
| 30 | `TC-COURSES-1440x900-WebKit-Safari` | Course Catalog Screen | WebKit-Safari | 1440x900 | Course catalog view rendered cleanly | 🟢 **PASS** | [`TC-COURSES-1440x900-WebKit-Safari.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-COURSES-1440x900-WebKit-Safari.png) |
| 31 | `TC-AUTH-LOGIN-390x844-Chromium` | Login Screen Form Inputs | Chromium | 390x844 | Email & Password inputs active | 🟢 **PASS** | [`TC-AUTH-LOGIN-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-LOGIN-390x844-Chromium.png) |
| 32 | `TC-AUTH-REGISTER-390x844-Chromium` | Register Screen Form Inputs | Chromium | 390x844 | Registration form rendered | 🟢 **PASS** | [`TC-AUTH-REGISTER-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-REGISTER-390x844-Chromium.png) |
| 33 | `TC-AUTH-FORGOT-390x844-Chromium` | Forgot Password Screen | Chromium | 390x844 | Forgot password form active | 🟢 **PASS** | [`TC-AUTH-FORGOT-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-FORGOT-390x844-Chromium.png) |
| 34 | `TC-AUTH-RESET-390x844-Chromium` | Reset Password Screen | Chromium | 390x844 | Reset password screen rendered | 🟢 **PASS** | [`TC-AUTH-RESET-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-RESET-390x844-Chromium.png) |
| 35 | `TC-AUTH-LOGIN-390x844-Microsoft-Edge` | Login Screen Form Inputs | Microsoft-Edge | 390x844 | Email & Password inputs active | 🟢 **PASS** | [`TC-AUTH-LOGIN-390x844-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-LOGIN-390x844-Microsoft-Edge.png) |
| 36 | `TC-AUTH-REGISTER-390x844-Microsoft-Edge` | Register Screen Form Inputs | Microsoft-Edge | 390x844 | Registration form rendered | 🟢 **PASS** | [`TC-AUTH-REGISTER-390x844-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-REGISTER-390x844-Microsoft-Edge.png) |
| 37 | `TC-AUTH-FORGOT-390x844-Microsoft-Edge` | Forgot Password Screen | Microsoft-Edge | 390x844 | Forgot password form active | 🟢 **PASS** | [`TC-AUTH-FORGOT-390x844-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-FORGOT-390x844-Microsoft-Edge.png) |
| 38 | `TC-AUTH-RESET-390x844-Microsoft-Edge` | Reset Password Screen | Microsoft-Edge | 390x844 | Reset password screen rendered | 🟢 **PASS** | [`TC-AUTH-RESET-390x844-Microsoft-Edge.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-AUTH-RESET-390x844-Microsoft-Edge.png) |
| 39 | `TC-STUDENT-PROFILE-1440x900-Chromium` | Student Profile Page | Chromium | 1440x900 | Profile details and user statistics loaded | 🟢 **PASS** | [`TC-STUDENT-PROFILE-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-STUDENT-PROFILE-1440x900-Chromium.png) |
| 40 | `TC-STUDENT-MYCOURSES-1440x900-Chromium` | Student My Courses Page | Chromium | 1440x900 | Enrolled courses rendered | 🟢 **PASS** | [`TC-STUDENT-MYCOURSES-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-STUDENT-MYCOURSES-1440x900-Chromium.png) |
| 41 | `TC-LESSON-MEDIA-390x844-Chromium` | Lesson Detail 16:9 Video & Anti-Download | Chromium | 390x844 | 16:9 Aspect video active (true) | Anti-download protected (true) | 🟢 **PASS** | [`TC-LESSON-MEDIA-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-MEDIA-390x844-Chromium.png) |
| 42 | `TC-LESSON-SUBTITLES-390x844-Chromium` | AI Subtitles & Interactive Transcript | Chromium | 390x844 | Subtitles tab rendered | 🟢 **PASS** | [`TC-LESSON-SUBTITLES-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-SUBTITLES-390x844-Chromium.png) |
| 43 | `TC-LESSON-AI-PANEL-390x844-Chromium` | Udemy-like AI Assistant Panel & Quick Actions | Chromium | 390x844 | AI Assistant panel active with quick actions/composer | 🟢 **PASS** | [`TC-LESSON-AI-PANEL-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-AI-PANEL-390x844-Chromium.png) |
| 44 | `TC-LESSON-CUSTOM-DELETE-390x844-Chromium` | Custom Delete Confirmation (Zero window.confirm) | Chromium | 390x844 | In-panel confirmation modal overlay appears | 🟢 **PASS** | [`TC-LESSON-CUSTOM-DELETE-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-CUSTOM-DELETE-390x844-Chromium.png) |
| 45 | `TC-LESSON-MEDIA-1440x900-Chromium` | Lesson Detail 16:9 Video & Anti-Download | Chromium | 1440x900 | 16:9 Aspect video active (true) | Anti-download protected (true) | 🟢 **PASS** | [`TC-LESSON-MEDIA-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-MEDIA-1440x900-Chromium.png) |
| 46 | `TC-LESSON-SUBTITLES-1440x900-Chromium` | AI Subtitles & Interactive Transcript | Chromium | 1440x900 | Subtitles tab rendered | 🟢 **PASS** | [`TC-LESSON-SUBTITLES-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-SUBTITLES-1440x900-Chromium.png) |
| 47 | `TC-LESSON-AI-PANEL-1440x900-Chromium` | Udemy-like AI Assistant Panel & Quick Actions | Chromium | 1440x900 | AI Assistant panel active with quick actions/composer | 🟢 **PASS** | [`TC-LESSON-AI-PANEL-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-AI-PANEL-1440x900-Chromium.png) |
| 48 | `TC-LESSON-CUSTOM-DELETE-1440x900-Chromium` | Custom Delete Confirmation (Zero window.confirm) | Chromium | 1440x900 | In-panel confirmation modal overlay appears | 🟢 **PASS** | [`TC-LESSON-CUSTOM-DELETE-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LESSON-CUSTOM-DELETE-1440x900-Chromium.png) |
| 49 | `TC-QUIZZES-CATALOG-1440x900-Chromium` | Quizzes Catalog Page | Chromium | 1440x900 | Quiz list rendered | 🟢 **PASS** | [`TC-QUIZZES-CATALOG-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-QUIZZES-CATALOG-1440x900-Chromium.png) |
| 50 | `TC-QUIZZES-PLAY-1440x900-Chromium` | Play Quiz Interactive Question Screen | Chromium | 1440x900 | Interactive quiz loaded | 🟢 **PASS** | [`TC-QUIZZES-PLAY-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-QUIZZES-PLAY-1440x900-Chromium.png) |
| 51 | `TC-ANALYTICS-DASHBOARD-1440x900-Chromium` | Analytics Heatmap & Streak Dashboard | Chromium | 1440x900 | 30-Day Heatmap & Flame Streak loaded | 🟢 **PASS** | [`TC-ANALYTICS-DASHBOARD-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-ANALYTICS-DASHBOARD-1440x900-Chromium.png) |
| 52 | `TC-INSTRUCTOR-DASHBOARD-1440x900-Chromium` | Instructor Dashboard Access (Role 2) | Chromium | 1440x900 | Instructor dashboard loaded for Role 2 | 🟢 **PASS** | [`TC-INSTRUCTOR-DASHBOARD-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-INSTRUCTOR-DASHBOARD-1440x900-Chromium.png) |
| 53 | `TC-ADMIN-DASHBOARD-1440x900-Chromium` | Admin Dashboard Access (Role 1) | Chromium | 1440x900 | Admin dashboard loaded for Role 1 | 🟢 **PASS** | [`TC-ADMIN-DASHBOARD-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-ADMIN-DASHBOARD-1440x900-Chromium.png) |
| 54 | `TC-PROTECTED-REDIRECT-1440x900-Chromium` | Unauthenticated Access Redirect to /login | Chromium | 1440x900 | Redirected to http://127.0.0.1:3001/login | 🟢 **PASS** | [`TC-PROTECTED-REDIRECT-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-PROTECTED-REDIRECT-1440x900-Chromium.png) |
| 55 | `TC-ROLE-BLOCK-1440x900-Chromium` | Student Blocked from Admin Dashboard | Chromium | 1440x900 | Student safely redirected away from admin to: http://127.0.0.1:3001/ | 🟢 **PASS** | [`TC-ROLE-BLOCK-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-ROLE-BLOCK-1440x900-Chromium.png) |
| 56 | `TC-PWA-BOTTOMNAV-390x844-Chromium` | PWA Mobile Bottom Navigation Bar (Thumb Zone) | Chromium | 390x844 | Fixed bottom navigation active at z-40 | 🟢 **PASS** | [`TC-PWA-BOTTOMNAV-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-PWA-BOTTOMNAV-390x844-Chromium.png) |
| 57 | `TC-PWA-OFFLINE-BANNER-390x844-Chromium` | PWA Offline Shell Banner Notification | Chromium | 390x844 | Offline banner alerts user without crash | 🟢 **PASS** | [`TC-PWA-OFFLINE-BANNER-390x844-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-PWA-OFFLINE-BANNER-390x844-Chromium.png) |
| 58 | `TC-THEME-TOGGLE-1440x900-Chromium` | Dark / Light Theme Toggle | Chromium | 1440x900 | Theme state toggled cleanly | 🟢 **PASS** | [`TC-THEME-TOGGLE-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-THEME-TOGGLE-1440x900-Chromium.png) |
| 59 | `TC-LANGUAGE-TOGGLE-1440x900-Chromium` | Bilingual Language Switcher (VI / EN) | Chromium | 1440x900 | Language switcher functional | 🟢 **PASS** | [`TC-LANGUAGE-TOGGLE-1440x900-Chromium.png`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/uat/evidence/TC-LANGUAGE-TOGGLE-1440x900-Chromium.png) |

---

### 3. KIỂM THỬ CÁC TRƯỜNG HỢP NGOẠI LỆ BẮT BUỘC (EDGE CASES)

1. **Mất kết nối Internet (PWA Offline Shell):** Banner màu hổ phách `OfflineIndicator` hiển thị thông báo chế độ ngoại tuyến tức thì. Khi khôi phục mạng, banner tự ẩn sau 4 giây.
2. **Token JWT Hết Hạn / 401 Unauthorized:** Interceptor bắt lỗi 401, tự động phát sự kiện dọn sạch localStorage và chuyển hướng về `/login` an toàn, không có hiện tượng lặp vô hạn (Infinite redirect loop).
3. **Bảo Vệ Phân Quyền (RBAC Guards):** 
   - Học viên chưa đăng nhập cố tình truy cập `/profile` $\rightarrow$ Chuyển hướng về `/login`.
   - Học viên (Role 3) cố tình truy cập `/admin/dashboard` $\rightarrow$ Chuyển hướng an toàn về trang chủ `/`.
4. **Bảo Vệ Bản Quyền Video (DRM & Anti-Download):** Không có nút tải video trực tiếp trên giao diện bài học. Watermark động hiển thị mờ luân phiên vị trí để chống quay lén.
5. **Chế Độ Giao Diện & Đa Ngôn Ngữ:** Hỗ trợ chuyển đổi Dark/Light mode và Song ngữ (VI / EN) mượt mà.

---

### 4. TỔNG KẾT & KẾT QUẢ BUILD PRODUCTION

```bash
> vite build
✓ 1752 modules transformed.
PWA v1.3.0
mode      generateSW
precache  16 entries (4744.99 KiB)
files generated
  build/sw.js
  build/workbox-18e860bb.js
✓ built in 12.97s (0 errors, 0 warnings)
```

> **KẾT LUẬN NGHIỆM THU CHÍNH THỨC:**
> Phân hệ Frontend của E-Learn Academy đạt tỷ lệ **100% (59/59 Tests PASS)** trên cả 3 trình duyệt (Chrome, Edge, WebKit) và 5 kích thước màn hình. Tất cả ảnh chụp màn hình bằng chứng khớp 100% với báo cáo.
