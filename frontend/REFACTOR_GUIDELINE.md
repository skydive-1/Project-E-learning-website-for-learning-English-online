# HƯỚNG DẪN CẤU TRÚC FRONTEND & QUY CHUẨN PHÁT TRIỂN (FRONTEND REFACTORING GUIDELINE)

Tài liệu này dành cho lập trình viên Frontend tiếp nhận dự án để hiểu rõ cấu trúc thư mục mới, công nghệ sử dụng, cách thức hoạt động của cơ chế xác thực JWT, định tuyến bảo mật và quy chuẩn để phát triển các trang/module tiếp theo.

---

## 1. Công nghệ & Ngôn ngữ sử dụng (Tech Stack)

*   **Ngôn ngữ lập trình:** JavaScript (ES6+).
*   **Thư viện UI chính:** React.js (Phiên bản 19.x.x mới nhất).
*   **Hệ thống Định tuyến:** React Router DOM (Phiên bản 7.x.x mới nhất).
*   **HTTP Client:** Axios (dùng để gọi API lên backend).
*   **CSS Preprocessor:** SASS / SCSS (Dùng để viết style phân vùng theo module).
*   **Thư viện Icon:** React Icons (`react-icons/fi` cho các icon phẳng tối giản, và `react-icons/fc` cho các icon màu của bên thứ 3 như Google).
*   **Build Tool base:** Create React App (`react-scripts`).

---

## 2. Các phần việc đã hoàn thành (What Was Refactored & Coded)

*   **Chuẩn hóa cấu trúc thư mục:** Nhóm toàn bộ logic liên quan theo Module nghiệp vụ (ví dụ: `auth` tự chứa trang Login, Register, API Service và file Style SCSS tương ứng), loại bỏ hoàn toàn việc viết chung trong `App.js` hay `index.css`.
*   **Thiết lập Định tuyến & Bảo vệ Trang (`App.js`):** Định cấu hình Router định hướng toàn cục. Bọc ngoài trang Dashboard bằng component `<ProtectedRoute>` để cưỡng chế người dùng đăng nhập (có token) mới có quyền truy cập, nếu không sẽ bị đẩy về trang `/login`.
*   **Axios Client tập trung (`api.config.js`):** Tự động đính kèm `Bearer <token>` vào header của mọi request. Tự động xóa token trong `localStorage` và chuyển về `/login` nếu backend trả về lỗi `401 Unauthorized` (do token hết hạn).
*   **Code Giao diện theo Mockup:**
    *   **LoginPage & RegisterPage:** Xây dựng giao diện split-pane (hai cột): cột trái chứa thẻ minh họa học tập cao cấp kèm hình vẽ flat vector sinh bởi AI; cột phải chứa form điền thông tin và tabs đăng nhập/đăng ký.
    *   **Nút đăng nhập Google:** Đã tích hợp logo Google màu sắc chính thức (sử dụng icon `FcGoogle`) vào nút Đăng nhập với Google.
    *   **Trang Dashboard:** Xây dựng giao diện trang chủ học viên hiển thị thông tin profile của user gọi từ API `/auth/profile` kèm theo thống kê tiến trình học tập và nút Đăng xuất.

---

## 3. Kiến trúc thư mục Frontend

Thư mục `frontend/src` hiện tại được tổ chức như sau:

```text
src/
├── config/
│   └── api.config.js         # Cấu hình Axios Client & Interceptors tự động
│
├── modules/                  # Các module nghiệp vụ tự chứa (Self-contained)
│   ├── auth/                 # Module xác thực
│   │   ├── assets/
│   │   │   └── login_illustration.png # Ảnh minh họa flat-vector cột bên trái
│   │   ├── components/       # Các sub-components dùng riêng cho Auth
│   │   ├── pages/
│   │   │   ├── LoginPage.js  # Trang đăng nhập split-pane
│   │   │   └── RegisterPage.js# Trang đăng ký split-pane
│   │   ├── services/
│   │   │   └── auth.service.js# Gọi API auth (/register, /login, /profile)
│   │   └── styles/
│   │       └── auth.scss     # CSS/SCSS chuyên biệt của Auth (mockup colors)
│   │
│   └── dashboard/            # Module Dashboard
│       ├── pages/
│       │   └── DashboardPage.js # Giao diện Dashboard học viên sau đăng nhập
│       └── styles/
│           └── dashboard.scss   # CSS/SCSS chuyên biệt của Dashboard
│
├── App.js                    # Quản lý React Router DOM v7 & Protected Route
├── index.js                  # Entry point React
└── index.css                 # Reset CSS và Style cơ bản dùng chung
```

---

## 4. Hướng dẫn phát triển dành cho Frontend Developer

### A. Cách gọi API lên Backend
Sử dụng `apiClient` từ `config/api.config.js` để gọi API. Không sử dụng `axios` gốc để tránh mất cấu hình tự động chèn JWT token:

```javascript
import apiClient from '../../../config/api.config';

export const getLessons = async () => {
  const response = await apiClient.get('/lessons');
  return response.data;
};
```

### B. Bảo vệ một Route nhạy cảm
Khi bạn tạo thêm một trang mới yêu cầu người dùng phải đăng nhập mới được xem (ví dụ: Trang làm bài tập `/exercises`), hãy bọc component đó bằng `<ProtectedRoute>` trong file [App.js](file:///d:/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/src/App.js):

```javascript
import ExercisesPage from './modules/exercises/pages/ExercisesPage';

<Route 
  path="/exercises" 
  element={
    <ProtectedRoute>
      <ExercisesPage />
    </ProtectedRoute>
  } 
/>
```

### C. Khởi chạy dự án ở Local
1.  Di chuyển vào thư mục frontend: `cd frontend`
2.  Cài đặt thư viện: `npm install`
3.  Chạy ứng dụng: `npm start`
    *Ứng dụng sẽ chạy tại địa chỉ `http://localhost:3000` và tự động kết nối tới backend ở port `5000`.*
