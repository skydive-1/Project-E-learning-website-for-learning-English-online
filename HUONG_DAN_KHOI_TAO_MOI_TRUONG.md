# 📚 HƯỚNG DẪN KHỞI TẠO MÔI TRƯỜNG LÀM VIỆC - DỰ ÁN E-LEARNING (CẬP NHẬT)

---

## 🎯 GIỚI THIỆU DỰ ÁN

**Sản phẩm:** Website E-learning học tiếng Anh tích hợp AI (Chatbot RAG, phân quyền VIP)

**Công nghệ:**
- **Frontend:** ReactJS (JavaScript thuần) + **Train AI RAG**
- **Backend:** Node.js/Express (JavaScript) + **Modular Monolith Architecture**
- **Database:** PostgreSQL + Pinecone (RAG Vector Store)
- **RAG Engine:** LangChain + Google Gemini + Pinecone

**Kiến trúc:** Modular Monolith (tất cả dùng chung 1 server, nhưng code chia thành modules riêng biệt)

**Cấu trúc nhóm & Trách nhiệm:**
- **Q.Anh:** Frontend + **Train & Deploy RAG Model**
- **Chương:** Database (PostgreSQL)
- **Liêm:** Backend (APIs + Modular Architecture) + **MyCliaude**

---

---

# 📱 HƯỚNG DẪN CHI TIẾT CHO Q.ANH (FRONTEND + RAG)

## ⚠️ LƯU Ý QUAN TRỌNG

**Q.Anh có 2 vai trò:**

1. **Frontend Developer** - Xây dựng UI/UX website học tiếng Anh
2. **RAG Engineer** - Train AI model để Chatbot trả lời câu hỏi

**Phân công RAG chi tiết:**

| Vai trò | Trách nhiệm |
|---------|------------|
| **Q.Anh (Frontend)** | ✅ Train RAG model, tạo embeddings, upload vectors |
| **Chương (Database)** | ⚙️ Lưu trữ & quản lý dữ liệu (PostgreSQL), vectors ở Pinecone |
| **Liêm (Backend)** | 🔌 Tạo API `/api/chatbot/ask` để frontend gọi |

---

## 1️⃣ CÀI ĐẶT PHẦN MỀM TIÊN QUYẾT (FRONTEND)

### Bước 1: Cài đặt Node.js

**Tại sao cần cài Node.js?**
- Node.js là nền tảng cho phép chạy JavaScript trên máy tính của bạn (ngoài trình duyệt).
- React cần Node.js để cài đặt thư viện, chạy server phát triển, và xây dựng ứng dụng.

**Hướng dẫn:**
1. Truy cập: [https://nodejs.org](https://nodejs.org)
2. Tải phiên bản **LTS** (Long Term Support) - đây là phiên bản ổn định nhất
3. Cài đặt bình thường, chọn "Next" và "Install"
4. Sau khi cài xong, mở **Command Prompt** (hoặc PowerShell) và gõ:
   ```bash
   node --version
   npm --version
   ```
   - Nếu hiện ra version number (ví dụ: v18.15.0) = cài đặt thành công ✅

**npm là gì?**
- npm = Node Package Manager
- npm giúp bạn tải về các thư viện, công cụ JavaScript mà dự án cần
- Nó tự động được cài khi bạn cài Node.js

### Bước 2: Cài đặt VS Code (Trình soạn thảo mã)

**Tại sao cần VS Code?**
- Đây là chương trình để viết code (giống như Notepad nhưng mạnh hơn nhiều)
- VS Code có tính năng hỗ trợ code tự động, tìm lỗi, và đẹp mắt

**Hướng dẫn:**
1. Truy cập: [https://code.visualstudio.com](https://code.visualstudio.com)
2. Tải bản cho Windows
3. Cài đặt bình thường

**Lập tức sau khi cài:**
- Mở VS Code
- Cài extension: "ES7+ React/Redux/React-Native snippets" (của dsznajder)
  - Điều này sẽ giúp bạn viết React code nhanh hơn

---

## 2️⃣ TẠO PROJECT REACTJS TRỐNG

### Bước 3: Mở Command Prompt và tạo project

**Câu lệnh:**
```bash
npx create-react-app frontend
```

**Giải thích từng từ:**
- `npx` = Công cụ để chạy các chương trình từ npm mà không cần cài đặt vĩnh viễn
- `create-react-app` = Công cụ chính thức của Facebook/Meta để tạo project React trống
- `frontend` = Tên thư mục dự án của bạn (bạn có thể đặt tên khác)

**Câu lệnh này sẽ:**
1. Tạo một thư mục tên `frontend`
2. Tạo tất cả file cấu trúc React cần thiết bên trong
3. Tự động cài đặt tất cả thư viện phụ thuộc (dependencies) - điều này mất 3-5 phút

**⏳ Đợi cho đến khi:**
- Dòng chữ "Happy hacking!" xuất hiện
- Terminal trở về trạng thái bình thường

---

## 3️⃣ SETUP CẤU TRÚC FRONTEND (MODULAR STRUCTURE)

### Bước 4: Tổ chức folder Frontend theo Modular Pattern

Sau khi tạo project React, hãy tạo cấu trúc folder như sau:

```bash
cd frontend
# Các lệnh tạo folder
mkdir -p src/modules
mkdir -p src/modules/auth
mkdir -p src/modules/lessons
mkdir -p src/modules/chatbot
mkdir -p src/modules/progress
mkdir -p src/components/common
mkdir -p src/services
mkdir -p src/hooks
mkdir -p src/utils
mkdir -p src/styles
mkdir -p src/config
```

**Cấu trúc folder hoàn chỉnh:**

```
frontend/
├── node_modules/
├── public/
├── src/
│   ├── modules/                    # 🎯 Các tính năng chính (Modular)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   ├── RegisterForm.jsx
│   │   │   │   └── ProfileCard.jsx
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.jsx
│   │   │   │   └── RegisterPage.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.js
│   │   │   ├── services/
│   │   │   │   └── authService.js
│   │   │   └── auth.module.scss
│   │   │
│   │   ├── lessons/
│   │   │   ├── components/
│   │   │   │   ├── LessonCard.jsx
│   │   │   │   ├── LessonList.jsx
│   │   │   │   └── LessonDetail.jsx
│   │   │   ├── pages/
│   │   │   │   ├── LessonsPage.jsx
│   │   │   │   └── LessonDetailPage.jsx
│   │   │   ├── services/
│   │   │   │   └── lessonService.js
│   │   │   └── lessons.module.scss
│   │   │
│   │   ├── chatbot/
│   │   │   ├── components/
│   │   │   │   ├── ChatBox.jsx
│   │   │   │   ├── ChatMessage.jsx
│   │   │   │   └── ChatInput.jsx
│   │   │   ├── pages/
│   │   │   │   └── ChatbotPage.jsx
│   │   │   ├── services/
│   │   │   │   └── chatbotService.js
│   │   │   ├── hooks/
│   │   │   │   └── useChat.js
│   │   │   └── chatbot.module.scss
│   │   │
│   │   └── progress/
│   │       ├── components/
│   │       │   ├── ProgressBar.jsx
│   │       │   └── ProgressChart.jsx
│   │       ├── pages/
│   │       │   └── ProgressPage.jsx
│   │       ├── services/
│   │       │   └── progressService.js
│   │       └── progress.module.scss
│   │
│   ├── components/                 # 🔧 Shared Components
│   │   └── common/
│   │       ├── Header.jsx
│   │       ├── Footer.jsx
│   │       ├── Navbar.jsx
│   │       ├── Button.jsx
│   │       ├── Loading.jsx
│   │       └── ErrorBoundary.jsx
│   │
│   ├── services/                   # 🌐 API Services
│   │   ├── api.js                  # Cấu hình axios/fetch
│   │   └── constants.js
│   │
│   ├── hooks/                      # 🎣 Custom Hooks
│   │   ├── useFetch.js
│   │   └── useLocalStorage.js
│   │
│   ├── utils/                      # 🛠️ Utilities
│   │   ├── helpers.js
│   │   ├── validators.js
│   │   └── formatters.js
│   │
│   ├── styles/                     # 🎨 Global Styles
│   │   ├── globals.scss
│   │   ├── variables.scss
│   │   └── mixins.scss
│   │
│   ├── config/                     # ⚙️ Configuration
│   │   └── config.js
│   │
│   ├── App.jsx                     # Main App Component
│   ├── App.scss
│   └── index.js
│
├── package.json
└── README.md
```

---

## 4️⃣ CHẠY PROJECT LẦN ĐẦU TIÊN

### Bước 5: Vào thư mục project và chạy

```bash
cd frontend
npm start
```

**Kết quả:**
- Trình duyệt tự động mở tại `http://localhost:3000`
- Bạn sẽ thấy trang React mặc định

---

## 📋 TỔNG KẾT LỆNH CHO Q.ANH (PHẦN FRONTEND)

```bash
# 1. Tạo project React
npx create-react-app frontend

# 2. Tạo cấu trúc thư mục modular
cd frontend
mkdir -p src/modules/{auth,lessons,chatbot,progress}
mkdir -p src/components/common
mkdir -p src/services
mkdir -p src/hooks
mkdir -p src/utils
mkdir -p src/styles
mkdir -p src/config

# 3. Chạy server phát triển
npm start

# Kết quả: Trình duyệt tự động mở với trang web tại http://localhost:3000
```

---

## 🤖 PHẦN 2: TRAIN RAG MODEL (QUAN TRỌNG!)

**👉 Hãy xem file hướng dẫn riêng:**

- **[HUONG_DAN_RAG_PYTHON.md](./HUONG_DAN_RAG_PYTHON.md)** - Train RAG bằng Python (dễ hơn)
- **[HUONG_DAN_RAG_NODEJS.md](./HUONG_DAN_RAG_NODEJS.md)** - Train RAG bằng Node.js (cùng stack)

**Q.Anh cần chọn 1 trong 2 cách ở trên để train RAG model!**

---

---

# 🗄️ HƯỚNG DẪN CHI TIẾT CHO CHƯƠNG (DATABASE)

## 1️⃣ CÀI ĐẶT POSTGRESQL + PGADMIN

### Tại sao cần PostgreSQL?
- PostgreSQL là **hệ quản trị cơ sở dữ liệu** (DBMS)
- Nó lưu trữ tất cả dữ liệu của ứng dụng (tài khoản người dùng, bài học, tiến độ học, v.v.)
- PostgreSQL rất phổ biến, mạnh mẽ, và miễn phí

### Tại sao cần pgAdmin?
- pgAdmin là ứng dụng giao diện giúp bạn **quản lý dữ liệu một cách dễ dàng**
- Thay vì gõ lệnh phức tạp, bạn có thể nhấn chuột để tạo bảng, thêm dữ liệu, v.v.

### ⚠️ QUAN TRỌNG: Về pgvector

**pgvector là gì?**
- pgvector là **extension PostgreSQL** để lưu trữ vectors (dạng dữ liệu đặc biệt)

**Liệu Chương có cần pgvector không?**
- ❌ **KHÔNG** - Vectors được lưu ở **Pinecone** (vector database chuyên dụng)
- ✅ Chương chỉ cần biết pgvector tồn tại, nhưng không cần cài nó

**Chương cần làm gì?**
1. Cài PostgreSQL + pgAdmin
2. Tạo database cho ứng dụng (tên: `elearning_db`)
3. Tạo các bảng cần thiết (users, courses, lessons, progress)

---

### Bước 1: Tải PostgreSQL cho Windows

1. Truy cập: [https://www.postgresql.org/download/windows](https://www.postgresql.org/download/windows)
2. Nhấn vào liên kết "Download the installer"
3. Chọn **"Windows x86-64"** (nếu máy bạn là 64-bit, thường là vậy)
4. Tải file `.exe` về

---

### Bước 2: Cài đặt PostgreSQL

1. **Chạy file cài đặt vừa tải**
2. Khi hỏi **"Setup Language"** → Chọn "English" → Click "OK"
3. Khi hỏi **"Installation Directory"** → Giữ mặc định → Click "Next"
4. Khi hỏi **"Select Components to install"**:
   - ✅ PostgreSQL Server (cần)
   - ✅ pgAdmin 4 (cần - để quản lý database)
   - ⚠️ Stack Builder (không cần cài nữa, vì không dùng pgvector)
   - Click "Next"

5. **Nhập mật khẩu cho user "postgres"**:
   - Đây là tài khoản quản trị cơ sở dữ liệu
   - ⚠️ **GHI NHỚ MẬT KHẨU NÀY** - bạn sẽ cần nó sau
   - Ví dụ: `postgres123`
   - Click "Next"

6. Chọn **Port = 5432** (cổng mặc định) → Click "Next"
7. Chọn **Locale = English** → Click "Next"
8. Click "Next" cho các bước tiếp theo cho đến khi hoàn thành

---

### Bước 3: Mở pgAdmin

**Sau khi cài xong:**
1. Tìm **pgAdmin 4** trong Start Menu (Windows)
2. Nhấp đôi để mở
3. Trình duyệt sẽ mở trang giao diện pgAdmin
4. Nhập email và mật khẩu để đăng nhập (tạo tài khoản ngay lần đầu)

**Giao diện pgAdmin:**
- Bên trái: Cây thư mục hiển thị **Servers** → **PostgreSQL** → **Databases**
- Bên phải: Chi tiết thông tin

---

### Bước 4: Tạo Database mới

1. Mở **pgAdmin 4**
2. Chuột phải vào **Databases** → **Create** → **Database**
3. Tên: `elearning_db`
4. Owner: `postgres` (mặc định)
5. Click "Save"

---

### Bước 5: Thiết kế Schema Database

**Hãy tạo các bảng sau (trong pgAdmin):**

#### **Bảng 1: users (Người dùng)**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  full_name VARCHAR(255),
  profile_picture_url VARCHAR(500),
  account_type VARCHAR(50) DEFAULT 'free',  -- 'free' hoặc 'vip'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Bảng 2: courses (Khóa học)**
```sql
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructor VARCHAR(255),
  level VARCHAR(50),  -- 'beginner', 'intermediate', 'advanced'
  thumbnail_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Bảng 3: lessons (Bài học)**
```sql
CREATE TABLE lessons (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  video_url VARCHAR(500),
  order_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

#### **Bảng 4: user_progress (Tiến độ học)**
```sql
CREATE TABLE user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);
```

#### **Bảng 5: chat_history (Lịch sử Chatbot)**
```sql
CREATE TABLE chat_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ai_model VARCHAR(100),  -- 'gemini', 'chatgpt', etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Cách thực hiện trong pgAdmin:**
1. Mở **pgAdmin 4**
2. Vào **Databases** → **elearning_db**
3. Click vào **Query Tool** (biểu tượng SQL)
4. Copy-paste từng bảng SQL ở trên
5. Click **Execute** (hoặc F5)

---

## 📋 TỔNG KẾT CÀI ĐẶT CHO CHƯƠNG

| Bước | Hành động | Lý do |
|------|-----------|-------|
| 1 | Tải PostgreSQL từ `postgresql.org` | Cơ sở dữ liệu chính của dự án |
| 2 | Cài PostgreSQL + pgAdmin | pgAdmin để quản lý database dễ dàng |
| 3 | Ghi nhớ mật khẩu `postgres` | Cần để kết nối từ Backend |
| 4 | Tạo database `elearning_db` | Nơi lưu data ứng dụng |
| 5 | Tạo 5 bảng (users, courses, lessons, progress, chat) | Schema database hoàn chỉnh |

---

---

# 🔧 HƯỚNG DẪN CHI TIẾT CHO LIÊM (BACKEND - MODULAR MONOLITH)

## ⚠️ KIẾN TRÚC BACKEND: MODULAR MONOLITH

**Tại sao chọn Modular Monolith?**
- ✅ Dễ setup (1 server = tất cả)
- ✅ Dễ development (3 sinh viên làm cùng)
- ✅ Dễ deploy + bảo trì
- ✅ Chi phí thấp (1 server)
- ⚠️ Không scale độc lập (nhưng không cần lúc này)

**Cách giảm thiểu nhược điểm:**
- ✅ Error handling tốt
- ✅ Logging + monitoring
- ✅ Caching (Redis tuỳ chọn)

---

## PHẦN A: SETUP CƠ BẢN

## 1️⃣ TẠO PROJECT NODE.JS

### Bước 1: Tạo thư mục dự án Backend

Mở **Command Prompt** và gõ:

```bash
mkdir backend
cd backend
```

---

### Bước 2: Khởi tạo project Node.js

```bash
npm init -y
```

---

### Bước 3: Cài đặt các packages cần thiết

```bash
npm install express dotenv pg cors bcryptjs jsonwebtoken
npm install --save-dev nodemon
```

**Giải thích từng package:**
- `express` = Framework web
- `dotenv` = Đọc biến từ `.env`
- `pg` = PostgreSQL client
- `cors` = Cho phép requests từ frontend
- `bcryptjs` = Hash password
- `jsonwebtoken` = JWT authentication
- `nodemon` = Auto-restart server khi code thay đổi

---

## 2️⃣ SETUP CẤU TRÚC BACKEND (MODULAR MONOLITH)

### Bước 4: Tạo cấu trúc folder

```bash
# Tạo folder structure
mkdir -p src/modules
mkdir -p src/modules/auth
mkdir -p src/modules/auth/controllers
mkdir -p src/modules/auth/services
mkdir -p src/modules/auth/routes
mkdir -p src/modules/auth/models

mkdir -p src/modules/courses
mkdir -p src/modules/courses/controllers
mkdir -p src/modules/courses/services
mkdir -p src/modules/courses/routes
mkdir -p src/modules/courses/models

mkdir -p src/modules/chatbot
mkdir -p src/modules/chatbot/controllers
mkdir -p src/modules/chatbot/services
mkdir -p src/modules/chatbot/routes

mkdir -p src/modules/progress
mkdir -p src/modules/progress/controllers
mkdir -p src/modules/progress/services
mkdir -p src/modules/progress/routes

mkdir -p src/middleware
mkdir -p src/config
mkdir -p src/utils
```

**Cấu trúc folder hoàn chỉnh:**

```
backend/
├── node_modules/
├── src/
│   ├── modules/                    # 🎯 Các modules (Modular Pattern)
│   │   │
│   │   ├── auth/
│   │   │   ├── controllers/
│   │   │   │   └── auth.controller.js      # Xử lý requests
│   │   │   ├── services/
│   │   │   │   └── auth.service.js         # Business logic
│   │   │   ├── models/
│   │   │   │   └── User.js                 # Database model
│   │   │   ├── routes/
│   │   │   │   └── auth.routes.js          # API routes
│   │   │   └── auth.module.js              # Module entry point
│   │   │
│   │   ├── courses/
│   │   │   ├── controllers/
│   │   │   │   └── courses.controller.js
│   │   │   ├── services/
│   │   │   │   └── courses.service.js
│   │   │   ├── models/
│   │   │   │   ├── Course.js
│   │   │   │   └── Lesson.js
│   │   │   ├── routes/
│   │   │   │   └── courses.routes.js
│   │   │   └── courses.module.js
│   │   │
│   │   ├── chatbot/
│   │   │   ├── controllers/
│   │   │   │   └── chatbot.controller.js
│   │   │   ├── services/
│   │   │   │   ├── chatbot.service.js
│   │   │   │   └── pinecone.service.js     # Tích hợp Pinecone
│   │   │   ├── routes/
│   │   │   │   └── chatbot.routes.js
│   │   │   └── chatbot.module.js
│   │   │
│   │   └── progress/
│   │       ├── controllers/
│   │       │   └── progress.controller.js
│   │       ├── services/
│   │       │   └── progress.service.js
│   │       ├── models/
│   │       │   └── Progress.js
│   │       ├── routes/
│   │       │   └── progress.routes.js
│   │       └── progress.module.js
│   │
│   ├── middleware/                 # 🔧 Shared Middleware
│   │   ├── auth.middleware.js       # JWT verification
│   │   ├── error.middleware.js      # Error handling
│   │   └── logger.middleware.js     # Logging
│   │
│   ├── config/                     # ⚙️ Configuration
│   │   ├── database.js             # Database connection
│   │   ├── pinecone.js             # Pinecone config
│   │   └── gemini.js               # Gemini config
│   │
│   ├── utils/                      # 🛠️ Utilities
│   │   ├── response.js             # Response formatting
│   │   ├── validators.js           # Input validation
│   │   └── helpers.js              # Helper functions
│   │
│   └── server.js                   # Main Express app
│
├── .env                            # Environment variables (GHI NHỚ: không commit!)
├── .gitignore
├── package.json
└── README.md
```

---

## 3️⃣ TẠO FILE `.env`

Trong folder `backend`, tạo file `.env`:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=elearning_db
DB_USER=postgres
DB_PASSWORD=postgres123

# JWT
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRE=7d

# Pinecone (RAG)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENV=us-east-1-aws
PINECONE_INDEX=elearning-rag

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Tạo `.gitignore`:**

```
node_modules/
.env
.DS_Store
dist/
build/
*.log
```

---

## 4️⃣ TẠO FILE SERVER.JS (MAIN APP)

Tạo file `src/server.js`:

```javascript
/**
 * Main Server File - E-learning Backend (Modular Monolith)
 * Architecture: Modular Monolith
 * - Tất cả modules dùng chung 1 server
 * - Mỗi module là một đơn vị độc lập
 * - Error handling tại từng layer
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ===== 1. IMPORT MODULES =====
// Mỗi module có entry point (module.js)
const authModule = require('./modules/auth/auth.module');
const coursesModule = require('./modules/courses/courses.module');
const chatbotModule = require('./modules/chatbot/chatbot.module');
const progressModule = require('./modules/progress/progress.module');

// ===== 2. IMPORT MIDDLEWARE =====
const errorHandler = require('./middleware/error.middleware');
const loggerMiddleware = require('./middleware/logger.middleware');

// ===== 3. KHỞI TẠO EXPRESS APP =====
const app = express();
const PORT = process.env.PORT || 5000;

// ===== 4. GLOBAL MIDDLEWARE =====
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging middleware
app.use(loggerMiddleware);

// ===== 5. MOUNT MODULES (ROUTES) =====
// Cấu trúc: /api/<module-name>
app.use('/api/auth', authModule);
app.use('/api/courses', coursesModule);
app.use('/api/chatbot', chatbotModule);
app.use('/api/progress', progressModule);

// ===== 6. HEALTH CHECK ENDPOINT =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'E-learning backend is running',
    timestamp: new Date().toISOString()
  });
});

// ===== 7. GLOBAL ERROR HANDLER =====
// Phải là middleware cuối cùng
app.use(errorHandler);

// ===== 8. START SERVER =====
app.listen(PORT, () => {
  console.log(`
    ╔═══════════════════════════════════════════╗
    ║   🚀 E-LEARNING BACKEND SERVER STARTED   ║
    ║   🌐 http://localhost:${PORT}                    ║
    ║   🏗️  Architecture: Modular Monolith      ║
    ║   ✅ Database: PostgreSQL                ║
    ║   🤖 RAG: Pinecone + Gemini              ║
    ╚═══════════════════════════════════════════╝
  `);
  console.log('✅ Available endpoints:');
  console.log('   - POST   /api/auth/register');
  console.log('   - POST   /api/auth/login');
  console.log('   - GET    /api/courses');
  console.log('   - POST   /api/chatbot/ask');
  console.log('   - GET    /api/progress/:userId');
  console.log('   - GET    /api/health');
});

module.exports = app;
```

---

## 5️⃣ TẠO ERROR HANDLER MIDDLEWARE

Tạo file `src/middleware/error.middleware.js`:

```javascript
/**
 * Global Error Handler Middleware
 * - Xử lý tất cả lỗi từ các modules
 * - Không để lỗi 1 module crash cả app
 * - Centralized error handling
 */

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`
    ❌ ERROR [${status}]:
    - Message: ${message}
    - URL: ${req.method} ${req.url}
    - Time: ${new Date().toISOString()}
  `);

  // Auth errors
  if (err.name === 'AuthError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: message
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: message
    });
  }

  // Database errors
  if (err.name === 'DatabaseError') {
    return res.status(503).json({
      success: false,
      error: 'Database connection error',
      message: 'Vui lòng thử lại sau'
    });
  }

  // Chatbot errors (không crash cả app)
  if (err.name === 'ChatbotError') {
    return res.status(503).json({
      success: false,
      error: 'Chatbot service unavailable',
      message: 'Tính năng chatbot hiện tạm thời không có sẵn'
    });
  }

  // Default error
  res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
```

---

## 6️⃣ TẠO MODULE ENTRY POINT (AUTH MODULE)

Tạo file `src/modules/auth/auth.module.js`:

```javascript
/**
 * Auth Module - Xác thực người dùng
 * - Login
 * - Register
 * - JWT verification
 */

const express = require('express');
const router = express.Router();
const authController = require('./controllers/auth.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
```

---

## 7️⃣ CHẠY SERVER

```bash
# Cập nhật package.json scripts
# Thêm vào "scripts":
"start": "node src/server.js",
"dev": "nodemon src/server.js"
```

Chạy server:

```bash
npm run dev
```

**Kết quả:**
```
╔═══════════════════════════════════════════╗
║   🚀 E-LEARNING BACKEND SERVER STARTED   ║
║   🌐 http://localhost:5000                ║
║   🏗️  Architecture: Modular Monolith      ║
║   ✅ Database: PostgreSQL                ║
║   🤖 RAG: Pinecone + Gemini              ║
╚═══════════════════════════════════════════╝
```

---

## 📋 TỔNG KẾT LỆNH CHO LIÊM (BACKEND MODULAR MONOLITH)

```bash
# 1. Tạo thư mục backend
mkdir backend
cd backend

# 2. Khởi tạo project Node.js
npm init -y

# 3. Cài đặt packages
npm install express dotenv pg cors bcryptjs jsonwebtoken
npm install --save-dev nodemon

# 4. Tạo cấu trúc folder
mkdir -p src/modules/{auth,courses,chatbot,progress}
mkdir -p src/{middleware,config,utils}

# 5. Tạo .env file (copy nội dung ở trên)

# 6. Tạo server.js (copy code ở trên)

# 7. Chạy server
npm run dev

# Kết quả: Server chạy tại http://localhost:5000
```

---

## 🎯 KIẾN TRÚC MODULAR MONOLITH CHI TIẾT

### **Quy trình Request trong Modular Monolith:**

```
┌─────────────────────────────────────┐
│      Frontend (React)                │
│      POST /api/chatbot/ask           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Express App (server.js)         │
│      - Global middleware             │
│      - Error handling                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Chatbot Module                  │
│  ├─ Route: /api/chatbot/ask          │
│  ├─ Controller: validate request     │
│  └─ Service: process question        │
└──────────────┬──────────────────────┘
               │
      ┌────────┴─────────┐
      │                  │
      ▼                  ▼
   Pinecone         Google Gemini
   (Search)         (Generate Response)
      │                  │
      └────────┬─────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Response to Frontend            │
│      { answer, sources }             │
└─────────────────────────────────────┘
```

---

## ⚠️ LƯU Ý QUAN TRỌNG (ERROR HANDLING)

**Để không crash cả app khi chatbot lỗi:**

```javascript
// chatbot.service.js
async function askChatbot(question) {
  try {
    // 1. Search vectors từ Pinecone
    const context = await pinecone.search(question);
    
    // 2. Generate response từ Gemini
    const response = await gemini.ask(question, context);
    
    return response;
  } catch (error) {
    console.error('Chatbot error:', error);
    
    // 3. Không throw, return error response
    return {
      error: true,
      message: 'Chatbot hiện tạm thời không khả dụng',
      fallback: 'Vui lòng thử lại sau hoặc liên hệ support'
    };
  }
}
```

---

---

# 🎓 GHI CHÚ CHUNG CHO CẢ NHÓ

## Cấu trúc dự án hoàn chỉnh sau khi khởi tạo

```
Project-E-learning-website-for-learning-English-online/
├── frontend/                         (ReactJS - Q.Anh)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── lessons/
│   │   │   ├── chatbot/
│   │   │   └── progress/
│   │   ├── components/common/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── config/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/                          (Node.js/Express - Liêm)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── models/
│   │   │   │   ├── routes/
│   │   │   │   └── auth.module.js
│   │   │   ├── courses/
│   │   │   ├── chatbot/
│   │   │   │   ├── services/
│   │   │   │   │   ├── chatbot.service.js
│   │   │   │   │   └── pinecone.service.js
│   │   │   │   └── chatbot.module.js
│   │   │   └── progress/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   └── logger.middleware.js
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── pinecone.js
│   │   │   └── gemini.js
│   │   ├── utils/
│   │   └── server.js
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── ...
│
├── rag-training/                     (RAG Training - Q.Anh)
│   ├── data/
│   ├── train-rag.py (hoặc train-rag.js)
│   ├── requirements.txt (hoặc package.json)
│   ├── .env
│   └── ...
│
├── HUONG_DAN_KHOI_TAO_MOI_TRUONG.md
├── HUONG_DAN_RAG_PYTHON.md
├── HUONG_DAN_RAG_NODEJS.md
├── NOTION_AI_PROMPT.md
└── ...
```

---

## 📊 SO SÁNH KIẾN TRÚC

| Tiêu chí | Modular Monolith | Microservices |
|----------|-----------------|---------------|
| **Độ phức tạp** | ⭐⭐ (Dễ) | ⭐⭐⭐⭐⭐ (Rất khó) |
| **Setup** | 1-2 tuần | 3-4 tuần |
| **Chi phí** | 💰 Thấp | 💰💰💰 Cao |
| **Phù hợp dự án?** | ✅✅✅ Tuyệt | ❌ Overkill |

---

## 📞 Q&A thường gặp

**Q: Liêm nên bắt đầu từ đâu?**
A: 
1. Setup backend cơ bản (server.js, Express)
2. Tạo cấu trúc folder modular
3. Tạo auth module trước (login/register)
4. Sau đó tạo courses module
5. Cuối cùng tạo chatbot module (sau khi Q.Anh train RAG xong)

**Q: Nếu chatbot lỗi, toàn bộ app sẽ crash không?**
A: KHÔNG, nếu error handling tốt:
- Try-catch ở chatbot service
- Global error handler middleware
- Return fallback response thay vì throw error

**Q: Database connection fail sẽ ảnh hưởng gì?**
A: Chỉ ảnh hưởng các APIs dùng database (auth, courses)
- Chatbot có thể vẫn hoạt động (nếu data cached)
- Health check endpoint có thể báo status

---

## 🚀 TIẾP THEO (BƯỚC 2)

Sau khi setup xong:

1. **Q.Anh:** 
   - Build React components (auth, lessons, chatbot)
   - Train RAG model
   - Upload embeddings lên Pinecone

2. **Chương:** 
   - Seed database (thêm data demo)
   - Tối ưu queries
   - Backup strategy

3. **Liêm:** 
   - Implement auth module
   - Implement courses module
   - Implement chatbot module (tích hợp Pinecone + Gemini)

---

**Chúc team may mắn! 🚀**

*Generated by: Tech Lead*
*Date: 2026-06-01*
*Updated: 2026-06-02 - Added Modular Monolith Architecture Guide for Frontend & Backend*
