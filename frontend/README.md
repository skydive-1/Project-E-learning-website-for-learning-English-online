# 🌐 E-Learn Academy Frontend

Giao diện người dùng hiện đại của nền tảng **E-Learn Academy**, được xây dựng trên nền tảng **React 19**, **Vite 5**, **TailwindCSS**, và **Shadcn/UI**, hỗ trợ **PWA (Progressive Web App)** và phát trực tuyến video bảo mật chuẩn công nghiệp.

---

## 👥 Thành viên nhóm phát triển (Graduation Project Team)

1. **NGUYỄN DŨNG QUỐC ANH** - Vai trò: *Frontend & AI UI Integration Developer*
2. **NGUYỄN THANH LIÊM** - Vai trò: *Backend & Security Developer*
3. **LÊ ĐÌNH CHƯƠNG** - Vai trò: *Database Administrator & Infrastructure Specialist*

---

## 🚀 Công nghệ & Thư viện chủ đạo

| Thành phần | Công nghệ | Chi tiết |
| :--- | :--- | :--- |
| **Core Framework** | React 19 + Vite 5 | Bundle siêu tốc với ESM, HMR tức thì |
| **Styling & UI** | TailwindCSS + Shadcn/UI + SASS | Thiết kế hiện đại, Dark/Light mode, tương thích chuẩn tiếp cận |
| **State & Fetching** | TanStack React Query v5 | Server state caching, tự động refetch và đồng bộ ngầm |
| **Client Routing** | React Router DOM v7 | Dynamic routing, route protection và code-splitting |
| **Video Player** | Shaka Player + Plyr | Dynamic Adaptive Streaming (DASH), token streaming bảo mật |
| **Tài liệu học tập** | React PDF (pdf.worker ESM) | Trình đọc PDF tích hợp, ghi chú và highlight trang |
| **Testing** | Vitest + Testing Library | **299/299 tests passed** trên 66 test suites |
| **Offline & PWA** | Vite Plugin PWA | Service worker precache, cài đặt trên thiết bị di động |

---

## 🛠️ Cài đặt & Khởi chạy

### Yêu cầu hệ thống
- **Node.js**: v24.x LTS (khuyến nghị)
- **npm**: v10+

### Các lệnh thực thi

```bash
# 1. Cài đặt dependencies
npm ci

# 2. Khởi chạy môi trường phát triển (Dev Server)
npm run dev
# Mặc định chạy tại: http://localhost:5173

# 3. Chạy toàn bộ bộ kiểm thử (Vitest)
npm test

# 4. Kiểm tra audit bảo mật dependencies
npm audit --omit=dev --audit-level=high

# 5. Build mã nguồn cho môi trường Production
npm run build

# 6. Xem trước bản build Production (Preview)
npm run preview
```

---

## 📁 Cấu trúc thư mục nguồn (`src/`)

```
frontend/src/
├── components/          # Các component dùng chung (UI primitives, Layout, Modals)
├── context/             # React Contexts (AuthContext, ThemeContext, LanguageContext, ToastContext)
├── hooks/               # Custom hooks (useAudioRecorder, useScrollLock, useStudyTimeTracker,...)
├── i18n/                # Hệ thống đa ngôn ngữ (tiếng Việt & tiếng Anh)
├── modules/             # Cấu trúc module hóa theo tính năng nghiệp vụ:
│   ├── academy/         # Lộ trình học (Roadmap), chi tiết lộ trình
│   ├── admin/           # Dashboard quản trị, quản lý token AI, cảnh báo vận hành
│   ├── auth/            # Đăng nhập, đăng ký, xác thực email, quên mật khẩu
│   ├── chatbot/         # Trợ lý AI học tập, streaming SSE, suggested questions
│   ├── courses/         # Danh sách khóa học, chi tiết khóa học, Course Editor
│   ├── homepage/        # Trang chủ, landing page giới thiệu tính năng
│   ├── instructor/      # Dashboard giảng viên, thống kê khóa học
│   ├── lessons/         # Học bài học, video player, PDF study viewer, bài tập nói
│   └── quizzes/         # Trắc nghiệm, bài tập Open Cloze, chấm điểm tức thì
├── services/            # API client (Axios instance, cấu hình interceptor gắn JWT)
└── utils/               # Tiện ích định dạng, xử lý token, mã hóa
```

---

## 🔒 Kiểm soát chất lượng & Kiểm thử (Quality Gate)

Trước mỗi lần triển khai, mã nguồn frontend phải vượt qua 100% các tiêu chí chất lượng nghiêm ngặt:
- **Unit & Integration Tests**: 100% pass với Vitest (`npm test`).
- **Production Build**: `npm run build` không phát sinh lỗi biên dịch hay cảnh báo chunk vượt ngưỡng.
- **Bảo mật**: Không chứa secret key, token nhạy cảm hay API key trong mã nguồn client.
