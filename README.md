# E-learning Website for English Learning with AI RAG Chatbot

## 🎯 GIỚI THIỆU DỰ ÁN
Dự án là một nền tảng học tiếng Anh trực tuyến toàn diện, được tích hợp trợ lý AI hỗ trợ học tập (Chatbot RAG) nhằm hỗ trợ phản xạ giao tiếp, tự luyện từ vựng và ngữ pháp theo lộ trình cá nhân hóa. Dự án sử dụng mô hình kiến trúc **Modular Monolith** ở phía Backend và **ReactJS** ở Frontend để đảm bảo tính rõ ràng, dễ bảo trì và mở rộng tốt.

---

## 🛠️ KIẾN TRÚC DỰ ÁN VÀ CÔNG NGHỆ (TECH STACK)

Dự án được phân chia thành 3 phần chính nằm trong cùng một repository:

### 1. Backend (`/backend`)
*   **Kiến trúc:** Modular Monolith (chia tách nghiệp vụ thành các module độc lập nhưng chạy trên cùng một tiến trình Server).
*   **Công nghệ:** Node.js, Express, PostgreSQL, Pinecone DB.
*   **Thư viện chính:**
    *   `@google/generative-ai`: Tương tác với mô hình Gemini API.
    *   `@pinecone-database/pinecone`: Quản lý CSDL Vector phục vụ Chatbot RAG.
    *   `pg`: Kết nối CSDL PostgreSQL (Supabase).
    *   `jsonwebtoken` & `bcryptjs`: Xác thực và mã hóa mật khẩu.
    *   `multer`: Xử lý upload tài liệu, media.

### 2. Frontend (`/frontend`)
*   **Kiến trúc:** Cấu trúc Modular (Module-based) tương ứng với các tính năng chính của hệ thống.
*   **Công nghệ:** ReactJS (Vite), TailwindCSS, Sass/SCSS.
*   **Thư viện chính:**
    *   `react-router-dom`: Quản lý routing phía client.
    *   `@tanstack/react-query`: Đồng bộ hóa trạng thái server và caching dữ liệu.
    *   `axios`: Gọi APIs kết nối Backend.
    *   `react-icons`: Bộ icon giao diện phong phú.

### 3. RAG Pipeline (`/rag-training`)
*   **Công nghệ:** Python, LangChain, Google Gemini API, Pinecone, PyPDF.
*   **Nhiệm vụ:**
    *   **Ingestion:** Đọc và tải tài liệu PDF/Text từ thư mục dữ liệu (`/data`).
    *   **Chunking:** Chia nhỏ văn bản sử dụng thuật toán thông minh (`TextChunker`).
    *   **Embeddings:** Tạo vector nhúng qua mô hình `text-embedding-004` của Gemini.
    *   **Vector Database:** Tải và đồng bộ hóa vector dữ liệu lên Pinecone Index làm kho tri thức cho chatbot.

---

## 📂 CẤU TRÚC THƯ MỤC CHÍNH

```
Project-E-learning-website-for-learning-English-online/
├── backend/                        # Backend Node.js/Express
│   ├── src/
│   │   ├── config/                 # Cấu hình Database & các biến môi trường
│   │   ├── middleware/             # Error handling, Auth, Logging middlewares
│   │   ├── modules/                # Kiến trúc Modular Monolith
│   │   │   ├── admin/              # Module Admin
│   │   │   ├── auth/               # Module Xác thực (Đăng ký, Đăng nhập, Profile)
│   │   │   ├── chatbot/            # Module AI Chatbot kết nối RAG
│   │   │   ├── courses/            # Module Khóa học & Môn học
│   │   │   ├── instructor/         # Module Instructor (Giáo viên quản lý khóa học)
│   │   │   ├── lessons/            # Module Quản lý bài học (Video, PDF, Quiz)
│   │   │   ├── progress/           # Module Theo dõi tiến trình học tập
│   │   │   └── quizzes/            # Module Tạo đề thi và làm bài trắc nghiệm
│   │   └── server.js               # Khởi chạy server chính
│   └── schema.sql                  # Cấu trúc CSDL PostgreSQL
│
├── frontend/                       # Frontend ReactJS (Vite)
│   ├── src/
│   │   ├── components/common/      # Component dùng chung (ProtectedRoute, ErrorBoundary,...)
│   │   ├── context/                # Context quản lý Auth và Theme (Dark/Light mode)
│   │   ├── modules/                # Module giao diện tương ứng với Backend
│   │   │   ├── academy/            # Roadmap học tập & Dashboard học viên
│   │   │   ├── admin/              # Quản lý hệ thống của Admin
│   │   │   ├── auth/               # Đăng nhập & Đăng ký
│   │   │   ├── chatbot/            # Giao diện Chatbot AI hỗ trợ học
│   │   │   ├── courses/            # Danh sách và chi tiết khóa học
│   │   │   ├── homepage/           # Trang chủ (Landing page)
│   │   │   ├── instructor/         # Dashboard biên soạn bài giảng của giáo viên
│   │   │   ├── lessons/            # Trình xem bài giảng tương tác
│   │   │   ├── profile/            # Trang cá nhân học viên
│   │   │   └── quizzes/            # Trang làm bài kiểm tra trắc nghiệm
│   │   ├── services/               # API clients kết nối backend
│   │   └── App.jsx                 # Cấu hình định tuyến và Providers chính
│
└── rag-training/                   # Script Python huấn luyện và nạp dữ liệu RAG
    ├── src/                        # Chứa các Module nạp, chia nhỏ, nhúng và đồng bộ Vector
    ├── config.yaml                 # Cấu hình tham số Chunk size, overlap, model tên
    ├── main.py                     # Entry point khởi chạy pipeline huấn luyện
    └── requirements.txt            # Thư viện Python cần thiết
```

---

## 🌟 CÁC TÍNH NĂNG CHÍNH ĐÃ HOÀN THÀNH

1.  **Xác thực người dùng (Authentication & RBAC):** Đăng ký, đăng nhập và phân quyền đa cấp bậc (Admin, Instructor, Student) sử dụng mã hóa Bcrypt và Token JWT.
2.  **Quản lý Khóa học & Chương trình giảng dạy (Course & Lesson Creator):**
    *   Giáo viên có thể khởi tạo khóa học, phân cấp chương học (Sections) và bài học (Lessons).
    *   Học viên có thể duyệt danh sách khóa học, xem chi tiết và đăng ký học.
3.  **Học tập tương tác đa phương tiện (Interactive Lessons):** Hỗ trợ bài học dưới các định dạng: Video bài giảng, Tài liệu PDF, Nội dung Text và Đề trắc nghiệm.
4.  **Theo dõi tiến trình học tập (Progress Tracking):** Lưu trữ và cập nhật trạng thái hoàn thành từng bài học, hiển thị trực quan thông qua thanh tiến độ.
5.  **Hệ thống Trắc nghiệm Tự luyện (Quizzes System):**
    *   Hỗ trợ tạo đề thi kèm giới hạn thời gian làm bài (Timer).
    *   Lưu lịch sử và điểm số của từng lượt làm bài (attempts).
    *   Hiển thị chi tiết đáp án đúng và lời giải thích (explanations) ngay sau khi nộp bài.
6.  **Trợ lý ảo tiếng Anh AI RAG Chatbot:**
    *   Chatbot nổi trực quan luôn hỗ trợ ở mọi trang.
    *   Hệ thống RAG thu hồi thông tin chính xác từ tài liệu tiếng Anh đã huấn luyện để phản hồi học viên bằng Gemini API và Pinecone.

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY DỰ ÁN

### ⚡ Cài đặt biến môi trường (.env)

*   **Backend (`/backend/.env`):**
    ```env
    PORT=5000
    DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname> # Supabase / PostgreSQL URI
    JWT_SECRET=your_jwt_secret_key_here
    GEMINI_API_KEY=your_gemini_api_key_here
    PINECONE_API_KEY=your_pinecone_api_key_here
    PINECONE_INDEX_NAME=your_pinecone_index_name_here
    ```

*   **Frontend (`/frontend/.env`):**
    ```env
    VITE_API_URL=http://localhost:5000/api
    ```

*   **RAG Pipeline (`/rag-training/.env`):**
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    PINECONE_API_KEY=your_pinecone_api_key_here
    ```

---

### ⚙️ Các bước khởi chạy chi tiết

#### Bước 1: Thiết lập Cơ sở dữ liệu (PostgreSQL)
Thực thi các câu lệnh SQL trong file [backend/schema.sql](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/backend/schema.sql) trên công cụ quản lý CSDL của bạn (ví dụ: Supabase SQL Editor hoặc pgAdmin) để khởi tạo bảng và chèn dữ liệu mẫu.

#### Bước 2: Chạy Backend Server
1.  Di chuyển vào thư mục backend:
    ```bash
    cd backend
    ```
2.  Cài đặt các thư viện Node.js:
    ```bash
    npm install
    ```
3.  Chạy server ở chế độ phát triển:
    ```bash
    npm run dev
    ```
    *(Server sẽ chạy tại địa chỉ http://localhost:5000)*

#### Bước 3: Chạy Frontend Client
1.  Di chuyển vào thư mục frontend:
    ```bash
    cd ../frontend
    ```
2.  Cài đặt các thư viện React:
    ```bash
    npm install
    ```
3.  Khởi động Vite Dev Server:
    ```bash
    npm run start
    ```
    *(Giao diện web sẽ khả dụng tại địa chỉ http://localhost:3000 hoặc http://localhost:5173 tùy cấu hình)*

#### Bước 4: Chạy Pipeline huấn luyện dữ liệu RAG (Python)
1.  Di chuyển vào thư mục rag-training:
    ```bash
    cd ../rag-training
    ```
2.  Khởi tạo môi trường ảo (khuyên dùng):
    ```bash
    python -m venv venv
    venv\Scripts\activate     # Trên Windows
    source venv/bin/activate  # Trên macOS/Linux
    ```
3.  Cài đặt các thư viện Python:
    ```bash
    pip install -r requirements.txt
    ```
4.  Đặt tài liệu học tiếng Anh (.pdf hoặc .txt) vào thư mục `rag-training/data/`.
5.  Khởi chạy pipeline nạp dữ liệu lên Pinecone:
    ```bash
    python main.py
    ```

---

## 📖 CÁC TÀI LIỆU HƯỚNG DẪN CHI TIẾT
*   **Hướng dẫn cấu hình và cài đặt môi trường ban đầu:** [HUONG_DAN_KHOI_TAO_MOI_TRUONG.md](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/HUONG_DAN_KHOI_TAO_MOI_TRUONG.md)
*   **Hướng dẫn chi tiết tích hợp RAG trong Node.js:** [HUONG_DAN_RAG_NODEJS.md](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/HUONG_DAN_RAG_NODEJS.md)
*   **Hướng dẫn hoạt động của mô hình RAG trong Python:** [HUONG_DAN_RAG_PYTHON.md](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/HUONG_DAN_RAG_PYTHON.md)
*   **Triết lý thiết kế và giao diện (Design Guidelines):** [DESIGN.md](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/DESIGN.md)
*   **Định vị sản phẩm & Phân khúc khách hàng:** [PRODUCT.md](file:///d:/BACKUP/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/PRODUCT.md)

---
*Chúc các thành viên nhóm hoàn thành tốt đồ án tốt nghiệp!*
