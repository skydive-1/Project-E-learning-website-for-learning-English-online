# HƯỚNG DẪN KIẾN TRÚC FRONTEND & QUY CHUẨN PHÁT TRIỂN (FRONTEND REFACTORING GUIDELINE)

Tài liệu này dành cho các lập trình viên phát triển Frontend tiếp nhận dự án nhằm nắm rõ cấu trúc thư mục mới, công nghệ sử dụng, cách vận hành của hệ thống xác thực tập trung, cơ chế quản lý bộ nhớ đệm (caching) API và các biện pháp bảo vệ chống đổ vỡ ứng dụng.

---

## 1. Công nghệ & Thư viện sử dụng (Modern Tech Stack)

*   **Runtime & UI Library**: React.js (v19.x) - tận dụng các cải tiến tối ưu hiệu năng render.
*   **Bundler & Build Tool**: [Vite](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/vite.config.js) (v5.x) - thay thế hoàn toàn Create React App (Webpack) để tăng tốc độ khởi động dev server và biên dịch.
*   **State Management & API Caching**: [TanStack Query](https://tanstack.com/query) (React Query v5) - quản lý trạng thái tải dữ liệu, tự động cache, đồng bộ ngầm và xử lý race condition.
*   **Centralized Authentication**: React Context API (`AuthContext`) - cung cấp trạng thái người dùng đăng nhập toàn cục.
*   **CSS Compiler**: Tailwind CSS (v3.x) chạy ở chế độ **Build-time** thông qua PostCSS và Autoprefixer. Loại bỏ hoàn toàn script Play CDN runtime trước đây để triệt tiêu độ trễ dựng trang của trình duyệt.
*   **Error Isolation**: Error Boundary - cơ chế cô lập lỗi hiển thị React Component.

---

## 2. Các nâng cấp kiến trúc quan trọng (Architectural Refactoring)

*   **Từ CRA Webpack sang Vite**:
    *   Tệp `index.html` được chuyển ra ngoài thư mục gốc (`frontend/index.html`) để làm điểm đầu vào mặc định cho Vite.
    *   Cấu hình cổng chạy mặc định là `3000`.
    *   **Bắt buộc**: Mọi tệp chứa cú pháp XML/JSX phải đổi phần mở rộng (extension) từ `.js` sang `.jsx`. Vite sẽ báo lỗi biên dịch nếu gặp JSX trong tệp `.js`.
*   **Tách biệt Cơ chế Xác thực Tập trung**:
    *   Xây dựng [AuthContext.jsx](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/src/context/AuthContext.jsx) lưu trữ trạng thái người dùng toàn cục (`user`, `loading`, `login`, `logout`, `refreshProfile`).
    *   Sử dụng Response Interceptor của Axios trong [api.config.js](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/src/config/api.config.js) để phát đi sự kiện mềm `'auth-logout'` khi gặp lỗi `401 Unauthorized` thay vì ép tải lại trang thô bạo. `AuthContext` sẽ lắng nghe sự kiện này để dọn dẹp bộ nhớ và điều hướng mượt mà về `/login`.
*   **Xóa bỏ Tailwind Play CDN**:
    *   Thiết lập Tailwind biên dịch tĩnh tại thời điểm Build qua [postcss.config.js](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/postcss.config.js) và [tailwind.config.js](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/tailwind.config.js).
    *   Đã nhúng trực tiếp chỉ thị `@tailwind base;`, `@tailwind components;`, và `@tailwind utilities;` vào [index.css](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/src/index.css).
*   **Cơ chế cô lập lỗi (Resilience & Fault Tolerance)**:
    *   Xây dựng [ErrorBoundary.jsx](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/src/components/common/ErrorBoundary.jsx) toàn cục bọc toàn bộ các route hiển thị.
    *   Áp dụng Error Boundary cục bộ cho các component nhạy cảm hoặc dễ lỗi như chatbot AI để đảm bảo khi chatbot gặp lỗi render, giao diện xung quanh (video bài giảng, mục lục) vẫn hoạt động bình thường.

---

## 3. Kiến trúc thư mục mới

Thư mục `frontend/src` được tổ chức khoa học theo Module nghiệp vụ tự chứa (Self-contained):

```text
src/
├── components/
│   └── common/
│       ├── ErrorBoundary.jsx  # Component bắt và cô lập lỗi render
│       ├── ProtectedRoute.jsx# Bảo vệ route theo token và quyền (Role)
│       └── Header.jsx        # Thanh điều hướng header dùng chung
│
├── config/
│   └── api.config.js         # Khởi tạo Axios Client, chèn Header JWT & xử lý lỗi 401
│
├── context/
│   └── AuthContext.jsx       # Quản lý Auth State tập trung (useAuth hook)
│
├── modules/                  # Các module nghiệp vụ cô lập
│   ├── auth/                 # Xác thực (Đăng nhập, Đăng ký, Profile)
│   ├── courses/              # Quản lý & Danh sách khoá học
│   ├── lessons/              # Giao diện học tập chi tiết & Chatbot RAG AI
│   └── profile/              # Trang cá nhân học viên
│
├── App.jsx                   # Khởi tạo QueryClientProvider, global ErrorBoundary & Routing
├── index.css                 # File CSS tĩnh chứa các chỉ thị Tailwind CSS compiled
└── main.jsx                  # Điểm đầu vào (Entry point) của ứng dụng thay cho index.js cũ
```

---

## 4. Hướng dẫn phát triển dành cho Frontend Developer

### A. Quản lý trạng thái và Caching với TanStack Query

Không tự ý gọi API qua `useEffect` thủ công nếu đó là luồng nạp dữ liệu (data fetching). Hãy sử dụng hook `useQuery` để dữ liệu được lưu cache và cập nhật ngầm:

```jsx
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';

// 1. Khai báo hàm gọi API
const fetchLessons = async (courseId) => {
  const { data } = await apiClient.get(`/courses/${courseId}/lessons`);
  return data;
};

// 2. Sử dụng useQuery trong Component
const CourseLessons = ({ courseId }) => {
  const { data: lessons, isLoading, error } = useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => fetchLessons(courseId),
    staleTime: 1000 * 60 * 5, // Cache có hiệu lực trong 5 phút
  });

  if (isLoading) return <div>Đang tải danh sách bài học...</div>;
  if (error) return <div>Không thể nạp dữ liệu bài học!</div>;

  return (
    <ul>
      {lessons.map(lesson => (
        <li key={lesson.id}>{lesson.title}</li>
      ))}
    </ul>
  );
};
```

Khi thực hiện cập nhật/thêm mới (Mutation), hãy chủ động xóa cache cũ để đồng bộ giao diện:

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (newLesson) => apiClient.post('/lessons', newLesson),
  onSuccess: () => {
    // Xóa bộ nhớ đệm của queryKey tương ứng để bắt buộc nạp lại dữ liệu mới nhất
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
  },
});
```

### B. Sử dụng Trạng thái Xác thực tập trung (`useAuth`)

Sử dụng hook `useAuth` để lấy thông tin đăng nhập và thực hiện thao tác Auth:

```jsx
import { useAuth } from '../../../context/AuthContext';

const UserProfile = () => {
  const { user, logout } = useAuth();

  return (
    <div>
      <p>Xin chào, {user?.fullName} (Role ID: {user?.roleId})</p>
      <button onClick={logout}>Đăng xuất</button>
    </div>
  );
};
```

### C. Bảo vệ các Route đặc quyền

Khi cấu hình định tuyến trong [App.jsx](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/frontend/src/App.jsx), sử dụng `<ProtectedRoute>` để bảo vệ route:

*   Yêu cầu đăng nhập thông thường:
    ```jsx
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    ```
*   Yêu cầu quyền hạn cụ thể (ví dụ: Giảng viên hoặc Quản trị viên có `roleId` là 1 hoặc 2):
    ```jsx
    <Route 
      path="/instructor/dashboard" 
      element={
        <ProtectedRoute allowedRoles={[1, 2]}>
          <InstructorDashboard />
        </ProtectedRoute>
      } 
    />
    ```

### D. Sử dụng Error Boundary để cô lập lỗi

Khi tích hợp các widget phụ trợ có khả năng lỗi cao (ví dụ: Chatbox AI, Trình phát Video của bên thứ ba), hãy bọc chúng trong `<ErrorBoundary>`:

```jsx
import ErrorBoundary from '../../../components/common/ErrorBoundary';

const LessonDetail = () => {
  return (
    <div className="flex">
      <div className="w-2/3">
        <VideoPlayer />
      </div>
      <div className="w-1/3">
        {/* Nếu ChatBox bị lỗi, VideoPlayer và phần còn lại của trang vẫn chạy bình thường */}
        <ErrorBoundary 
          title="Lỗi tải khung Chatbot AI" 
          message="Khung hội thoại RAG AI đang tạm thời gián đoạn. Bạn vẫn có thể học tiếp bình thường."
        >
          <ChatBox />
        </ErrorBoundary>
      </div>
    </div>
  );
};
```

---

## 5. Quy trình khởi chạy và Biên dịch ở Local

1.  Di chuyển vào thư mục frontend:
    ```bash
    cd frontend
    ```
2.  Cài đặt các gói phụ thuộc mới:
    ```bash
    npm install
    ```
3.  Khởi chạy chế độ phát triển (Development):
    ```bash
    npm start
    ```
    *Ứng dụng sẽ chạy tại địa chỉ `http://localhost:3000` thông qua bộ đóng gói siêu tốc của Vite.*
4.  Biên dịch tối ưu hóa cho sản xuất (Production Build):
    ```bash
    npm run build
    ```
    *CSS sẽ được biên dịch tối ưu hóa cùng JS tĩnh đặt trong thư mục `frontend/build`.*
