# 🎓 E-learning Website for English Learning with AI RAG Chatbot

**Nền tảng học tiếng Anh trực tuyến toàn diện với trợ lý AI hỗ trợ thông minh**

## 📋 Mục lục
- [Giới thiệu dự án](#giới-thiệu-dự-án)
- [Tính năng chính](#-tính-năng-chính)
- [Kiến trúc & Công nghệ](#-kiến-trúc--công-nghệ)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Cài đặt & Chạy](#-cài-đặt--chạy)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Trạng thái production](#-trạng-thái-production)

---

## 🎯 Giới thiệu dự án

Nền tảng **E-learning tiếng Anh** là một hệ thống học tập trực tuyến toàn diện, được tích hợp công nghệ **AI RAG Chatbot** để hỗ trợ:

- 📚 **Học tập đa phương tiện**: Video bài giảng, tài liệu PDF, trắc nghiệm tương tác, phát âm tiếng Anh
- 🤖 **Trợ lý AI thông minh**: Chatbot RAG kết nối Gemini API + Pinecone Vector DB, trả lời câu hỏi dựa trên tài liệu đã huấn luyện
- 📊 **Theo dõi tiến trình**: Dashboard học viên, thống kê điểm số, bảng xếp hạng gamification
- 🎥 **Bảo vệ nội dung**: Video DASH + ClearKey DRM, chống sao chép bất phép
- 👨‍🏫 **Công cụ giáo viên**: Tạo khóa học, quản lý bài học, phát sinh phụ đề tự động
- 🔐 **Quản lý toàn diện**: Phân quyền đa vai trò (Admin, Instructor, Student), xác thực JWT

**Live Demo**: https://project-e-learning-website-for-lear-iota.vercel.app

---

## ✨ Tính năng chính

### 1. **Xác thực & Quản lý người dùng**
- ✅ Đăng ký, đăng nhập với mã hóa Bcrypt
- ✅ Phân quyền RBAC: Admin, Instructor, Student
- ✅ JWT token-based session management
- ✅ Tùy chọn hồi phục mật khẩu qua email SMTP

### 2. **Quản lý khóa học & bài học**
- ✅ Tạo khóa học (Course) → Chương (Section) → Bài học (Lesson)
- ✅ Hỗ trợ bài học đa định dạng: Video, PDF, Text, Quiz
- ✅ Video DRM-protected (DASH + ClearKey license)
- ✅ Phụ đề tự động: Gemini STT + FFmpeg VAD

### 3. **Hệ thống trắc nghiệm**
- ✅ Tạo đề thi với timer, hỗ trợ câu hỏi trắc nghiệm
- ✅ Lưu lịch sử attempt, hiển thị giải thích chi tiết
- ✅ Quick Quiz được sinh tự động từ Gemini (AI-generated)
- ✅ Ngưỡng hoàn thành tối thiểu 50% để unlock bài tiếp theo

### 4. **AI RAG Chatbot**
- ✅ Intent Detection: phân biệt câu hỏi theo lesson hoặc general
- ✅ Semantic Retrieval: Tìm kiếm tương đồng qua Pinecone (similarity ≥ 0.58)
- ✅ Grounding Policy: Xác minh context & source trước khi trả lời
- ✅ Streaming SSE: Phản hồi real-time trên giao diện
- ✅ Chat History: Lưu trữ conversation cho personalization

### 5. **Theo dõi tiến trình & Gamification**
- ✅ Progress tracking: Hoàn thành từng bài, quiz attempts
- ✅ Achievements & Leaderboard: Hệ thống điểm, huy hiệu
- ✅ Analytics Dashboard: Thống kê cho Admin/Instructor
- ✅ Learning Roadmap: Lộ trình học được gợi ý

### 6. **Bảo vệ nội dung & DRM**
- ✅ Video DASH (Dynamic Adaptive Streaming)
- ✅ ClearKey encryption (license token-based)
- ✅ Watermark theo user & timestamp
- ✅ Shaka Packager für video packaging

---

## 🛠️ Kiến trúc & Công nghệ

### **Stack Tổng quát**

| Thành phần | Công nghệ | Phiên bản | Chi chú |
|-----------|-----------|----------|--------|
| **Backend** | Node.js + Express | v18+ | Modular Monolith |
| **Database** | PostgreSQL | 15+ | Supabase-compatible |
| **Frontend** | React 19 + Vite | 2024 | ESM, TailwindCSS |
| **RAG Pipeline** | Python 3.9+ | - | LangChain, Pinecone |
| **Vector DB** | Pinecone | Cloud | 768-dim embeddings |
| **LLM** | Google Gemini | API | Generative AI |
| **Video** | DASH + ClearKey | - | Shaka Packager |
| **Deployment** | Vercel + Docker | - | Cloud-native |

### **Thư viện chính**

**Backend:**
```javascript
@google/generative-ai        // Gemini LLM calls
@pinecone-database/pinecone  // Vector retrieval
pg                           // PostgreSQL client
jsonwebtoken & bcryptjs      // Auth & encryption
express-rate-limit           // Rate limiting
multer & fluent-ffmpeg       // Media handling
@supabase/supabase-js        // Optional cloud DB
```

**Frontend:**
```javascript
react & react-dom            // React 19
@tanstack/react-query        // Server state management
axios                        // HTTP client
react-router-dom             // Client-side routing
tailwindcss & sass           // Styling
recharts                     // Analytics charts
shaka-player                 // DASH video playback
react-pdf                    // PDF viewer
mic-recorder-to-mp3          // Audio capture
```

**RAG Pipeline:**
```python
google-genai                 // Gemini embeddings
pinecone-client              // Vector DB
langchain                    // RAG orchestration
PyPDF                        // PDF text extraction
```

---

## 📂 Cấu trúc thư mục

```
Project-E-learning-website-for-learning-English-online/
│
├── backend/                                    # 🟢 Node.js + Express Backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js                    # PostgreSQL connection pool
│   │   │   ├── environment.js                 # Production validation
│   │   │   └── ai-clients.js                  # Gemini + Pinecone initialization
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js             # JWT verification
│   │   │   ├── error.middleware.js            # Global error handler
│   │   │   ├── logger.middleware.js           # Request logging with requestId
│   │   │   └── rateLimit.middleware.js        # API rate limiting
│   │   ├── modules/                           # Modular Monolith Architecture
│   │   │   ├── auth/                          # Login, Register, Profile
│   │   │   │   ├── auth.routes.js
│   │   │   │   ├── auth.controller.js
│   │   │   │   └── auth.service.js
│   │   │   ├── courses/                       # Course CRUD, enrollment
│   │   │   ├── lessons/                       # Lesson content, auto-subtitle
│   │   │   │   ├── services/
│   │   │   │   │   └── subtitles.service.js   # FFmpeg + Gemini STT
│   │   │   │   └── controllers/lessons.controller.js
│   │   │   ├── chatbot/                       # RAG intent routing, retrieval
│   │   │   │   ├── services/
│   │   │   │   │   ├── chatbot.service.js     # Main RAG logic
│   │   │   │   │   ├── groundingPolicy.service.js # Verification
│   │   │   │   │   └── intentRouter.service.js
│   │   │   │   └── chatbot.routes.js
│   │   │   ├── progress/                      # Track lesson completion
│   │   │   ├── quizzes/                       # Quiz creation, grading
│   │   │   ├── admin/                         # System management
│   │   │   ├── gamification/                  # Achievements, leaderboard
│   │   │   ├── drm/                           # DASH/ClearKey licensing
│   │   │   └── ...other modules
│   │   ├── utils/
│   │   │   ├── speakingScorer.js              # Speech evaluation
│   │   │   ├── dashPackager.util.js           # Clear DASH packaging for Shaka/MSE
│   │   │   └── mediaCleanup.worker.js         # Orphan file cleanup
│   │   └── server.js                          # App initialization & mount routes
│   ├── tests/                                 # 325 passing tests
│   │   ├── auth_middleware.test.js
│   │   ├── progress_completion_threshold.test.js
│   │   ├── rate_limit.test.js
│   │   └── ...others
│   ├── schema.sql                             # Database schema with all tables
│   ├── package.json                           # Dependencies
│   ├── Dockerfile                             # Docker container
│   └── .env.example                           # Configuration template
│
├── frontend/                                   # 🔵 React 19 + Vite Frontend
│   ├��─ src/
│   │   ├── components/
│   │   │   ├── common/                        # Shared components
│   │   │   │   ├── ProtectedRoute.jsx         # Auth guard
│   │   │   │   └── ErrorBoundary.jsx
│   │   │   └── ...module-specific
│   │   ├── context/
│   │   │   ├── AuthContext.jsx                # User session
│   │   │   └── ThemeContext.jsx               # Dark/Light mode
│   │   ├── modules/                           # Feature-aligned structure
│   │   │   ├── auth/
│   │   │   │   ├── pages/LoginPage.jsx
│   │   │   │   └── pages/RegisterPage.jsx
│   │   │   ├── courses/                       # Browse & enroll
│   │   │   ├── lessons/
│   │   │   │   ├── pages/LessonDetailPage.jsx # Shaka player integration
│   │   │   │   └── components/VideoPlayer.jsx
│   │   │   ├── chatbot/                       # Floating AI assistant
│   │   │   │   ├── components/ChatbotWidget.jsx
│   │   │   │   └── services/chatbot.service.js
│   │   │   ├── quizzes/                       # Quiz UI & timer
│   │   │   ├── admin/                         # Analytics dashboard
│   │   │   └── ...others
│   │   ├── services/                          # API clients
│   │   │   ├── api.js                         # Axios instance
│   │   │   ├── authService.js
│   │   │   ├── chatbotService.js
│   │   │   └── ...others
│   │   ├── hooks/                             # Custom React hooks
│   │   ├── utils/                             # Helper functions
│   │   ├── App.jsx                            # Routes & Providers
│   │   └── main.jsx                           # Entry point
│   ├── package.json
│   ├── vite.config.js                         # Build configuration
│   └── tailwind.config.js
│
├── rag-training/                              # 🟡 Python RAG Pipeline
│   ├── src/
│   │   ├── config.py                          # RAG configuration
│   │   ├── ingestion/
│   │   │   └── loader.py                      # Load PDF/TXT documents
│   │   ├── chunking/
│   │   │   └── chunker.py                     # RecursiveCharacterSplitter
│   │   ├── embeddings/
│   │   │   └── embedder.py                    # Gemini embeddings (768-dim)
│   │   └── vectordb/
│   │       └── vector_store.py                # Pinecone upsert & retrieval
│   ├── main.py                                # Entry point (--lesson-id, --data-folder)
│   ├── requirements.txt                       # Dependencies
│   └── config.yaml                            # Chunk size, overlap, model config
│
├── docker-compose.yml                         # Local development orchestration
├── vercel.json                                # Vercel deployment config
├── package.json                               # Root workspace
│
├── README.md                                  # This file
├── DESIGN.md                                  # Design system, color palette, typography
├── PRODUCT.md                                 # Product positioning, user research
├── PRODUCTION_READINESS_AUDIT.md             # Comprehensive audit report
├── PROJECT_STRUCTURE_CLEANUP.md              # Refactoring guidelines
│
└── .github/
    └── workflows/                             # CI/CD pipelines (if any)
```

---

## ⚙️ Cài đặt & Chạy

### **Yêu cầu hệ thống**

- **Node.js**: v18 or higher
- **Python**: 3.9+
- **PostgreSQL**: 15+ (hoặc Supabase)
- **FFmpeg**: cho auto-subtitle (optional)
- **Docker** (optional, để dùng docker-compose)

### **1️⃣ Clone & Setup**

```bash
git clone https://github.com/skydive-1/Project-E-learning-website-for-learning-English-online.git
cd Project-E-learning-website-for-learning-English-online
```

### **2️⃣ Cấu hình biến môi trường**

#### Backend (`.env` file)
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elearning_db
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=elearning_db
DB_SSL=false

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRE=7d

# Admin
SUPER_ADMIN_EMAILS=your_email@example.com

# AI / RAG
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.7-flash
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENV=us-east-1-aws
PINECONE_INDEX=elearning-rag

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Frontend URL (liệt kê chính xác, phân tách bằng dấu phẩy nếu có preview domain)
FRONTEND_URL=http://localhost:3001

# Adaptive video & media
ENABLE_DASH_PACKAGING=true
ENABLE_SUBTITLE_VAD=true
DISABLE_RATE_LIMIT=true  # development only
```

#### Frontend (`.env` file)
```env
VITE_API_URL=http://localhost:5000/api
```

#### RAG Training (`.env` file)
```env
GEMINI_API_KEY=your_gemini_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
```

### **3️⃣ Option A: Chạy với Docker Compose (Recommended)**

```bash
# Build và khởi chạy tất cả services
docker-compose up --build

# Services sẽ chạy tại:
# - Frontend: http://localhost:3001
# - Backend:  http://localhost:5000/api-docs
# - Database: localhost:5432
```

### **3️⃣ Option B: Chạy Local (Manual Setup)**

#### **Database Setup**
```bash
# Khởi chạy PostgreSQL (hoặc dùng Supabase)
createdb elearning_db
psql elearning_db < backend/schema.sql
```

#### **Backend**
```bash
cd backend
npm install
npm run dev
# Server chạy ở http://localhost:5000
# Swagger UI: http://localhost:5000/api-docs
```

#### **Frontend**
```bash
cd frontend
npm install
npm run dev
# Vite dev server ở http://localhost:5173
# hoặc port khác tùy cấu hình
```

#### **RAG Pipeline** (optional, chạy khi cần huấn luyện)
```bash
cd rag-training
python -m venv venv
source venv/bin/activate  # hoặc venv\Scripts\activate on Windows
pip install -r requirements.txt

# Chuẩn bị tài liệu
mkdir -p data
cp /path/to/english_materials.pdf data/

# Chạy pipeline cho bài học ID 20
python main.py --lesson-id 20 --data-folder ./data
```

---

## 📚 Hướng dẫn sử dụng

### **Cho Học viên (Student)**

1. **Đăng ký tài khoản**: Vào trang "Register" → nhập email, password, tên
2. **Duyệt khóa học**: "Browse Courses" → chọn khóa → "Enroll"
3. **Học bài**: Vào khóa → xem video, PDF, tham gia quiz
4. **Hỏi AI Chatbot**: Click biểu tượng chatbot → hỏi câu tiếng Anh → nhận trả lời theo tài liệu bài học
5. **Xem tiến độ**: "Dashboard" → kiểm tra điểm số, achievements, hạng thứ

### **Cho Giáo viên (Instructor)**

1. **Tạo khóa học**: "My Courses" → "Create Course" → nhập thông tin
2. **Thêm bài học**:
   - Tạo section (chương)
   - Thêm lesson: chọn loại (video, PDF, quiz)
   - Upload video/tài liệu
3. **Quản lý quiz**: Tạo câu hỏi → đặt timer → xem kết quả học viên
4. **Xem analytics**: "Instructor Dashboard" → biểu đồ độ phổ biến, tỷ lệ hoàn thành

### **Cho Admin**

1. **Quản lý người dùng**: "Admin Panel" → danh sách user, khóa tài khoản nếu cần
2. **Thống kê hệ thống**: Xem tổng khóa học, số học viên, dashboard analytics
3. **Quản lý email consultation**: Xem danh sách yêu cầu, phân công cho support team

---

## 🔒 Trạng thái Production

### ✅ **Đã xác minh & sẵn sàng**

- ✅ **Kiến trúc**: Modular Monolith backend với clear separation of concerns
- ✅ **Authentication**: JWT + Bcrypt, Multi-role RBAC (Admin/Instructor/Student)
- ✅ **Database**: Schema validated, migrations in place, production connection pooling
- ✅ **Error Handling**: Global middleware, proper HTTP status codes, request tracking (requestId)
- ✅ **Rate Limiting**: API-wide & endpoint-specific limiters active
- ✅ **Logging**: Structured JSON logging with timestamps, requestId, user context
- ✅ **Testing**: Backend 325/325 và frontend 236/236 test pass (đối soát ngày 12/09/2026)
- ✅ **Documentation**: README, DESIGN.md, PRODUCT.md, PRODUCTION_READINESS_AUDIT.md
- ✅ **Deployment**: Docker-compose ready, live on Vercel
- ✅ **Video Protection**: DASH + ClearKey DRM fully implemented
- ✅ **RAG Grounding**: Policy validation ensures AI responses are grounded in course materials
- ✅ **Gemini RPD Fallback**: Router bỏ qua model đã chạm cap theo telemetry backend, chuyển sang model còn quota và tự mở lại sau 00:00 Pacific (14:00 PDT / 15:00 PST giờ Việt Nam); RPM/TPM tính theo cửa sổ trượt 60 giây; Google AI Studio/429 vẫn là nguồn đối chiếu cuối

### ⚠️ **Cần chú ý trước production**

1. **Database Migration Transition**
   - Đã có migration versioned, transaction, checksum và bảng `schema_migrations`; `schema.sql` cũng có test parity.
   - `database.js` vẫn giữ một số DDL idempotent lúc khởi động để tương thích database cũ. Việc còn lại là chuyển hết các DDL này sang migration versioned rồi bỏ lớp tương thích.

2. **Frontend Bundle**
   - Production build ngày 12/09/2026: main JS 690.56 kB (gzip 226.41 kB), không còn cảnh báo chunk vượt ngưỡng cấu hình.
   - Shaka, PDF và charts đã tách thành chunk riêng; PDF worker 1,046.21 kB chỉ tải cùng luồng PDF.

3. **Rate Limiting theo chế độ triển khai**
   - Chế độ 0 VND một instance dùng MemoryStore; hệ thống ghi rõ trạng thái này khi chạy production.
   - Khi có sẵn Redis-compatible store miễn phí, `REDIS_URL` kích hoạt shared `RedisStore`. `RATE_LIMIT_REQUIRE_SHARED_STORE=true` cảnh báo nếu cấu hình nhiều instance nhưng thiếu shared store.

4. **Unverified Live Flows** (cần E2E testing)
   - Auto-subtitle với voice thật qua Gemini
   - RAG live retrieval qua Pinecone + Gemini
   - Video DRM playback trên browser (Playwright/Cypress)
   - SMTP email delivery

5. **Error Handling Consistency**
   - DRM & Gamification controller tự return 500 → không dùng shared error middleware
   - **Fix**: Chuyển qua `next(error)` pattern

6. **Monitoring & Logging**
   - Logger ghi qua `console` → mất log khi container không capture stdout
   - **Fix**: Dùng Pino/Winston với centralized logging (CloudWatch, Datadog, ELK)

### 🚀 **Deployment Checklist**

```bash
# Pre-deployment
[ ] Cấp API keys (Gemini, Pinecone, SMTP)
[ ] Database migration chạy thành công
[ ] npm run build (frontend) → no errors
[ ] npm test (backend) → all pass
[ ] docker-compose up → all services healthy
[ ] Chạy smoke test trên staging

# Deployment
[ ] Set environment variables trên prod
[ ] Database schema update (if needed)
[ ] Deploy backend (Node.js container / Vercel)
[ ] Deploy frontend (Vercel / CloudFront)
[ ] Health check: GET /api/health → 200 OK
[ ] Smoke test live: login, browse courses, chat

# Post-deployment
[ ] Monitor logs (requestId tracing)
[ ] Verify Gemini/Pinecone/SMTP connectivity
[ ] Test video playback (DASH license serving)
[ ] Check rate limiting is active
```

---

## 📖 Tài liệu bổ sung

| File | Mô tả |
|------|-------|
| [DESIGN.md](./DESIGN.md) | Design system, color palette, typography, motion guidelines |
| [PRODUCT.md](./PRODUCT.md) | Product positioning, user research, brand personality |
| [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) | Chi tiết audit: fixed issues, known issues, unverified flows |
| [PROJECT_STRUCTURE_CLEANUP.md](./PROJECT_STRUCTURE_CLEANUP.md) | Refactoring guidelines, best practices |

---

## 🔗 Links quan trọng

- **Live Demo**: https://project-e-learning-website-for-lear-iota.vercel.app
- **API Documentation**: http://localhost:5000/api-docs (Swagger UI)
- **GitHub**: https://github.com/skydive-1/Project-E-learning-website-for-learning-English-online
- **Tech Stack**:
  - Backend: Node.js + Express
  - Frontend: React 19 + Vite
  - Database: PostgreSQL
  - Vector DB: Pinecone
  - LLM: Google Gemini
  - Video: DASH + Shaka Player

---

## 👨‍💻 Công nghệ & Tiếp cận

- **Architecture**: Modular Monolith (backend), Module-based (frontend)
- **Code Quality**: Linting, formatting, backend 325/325 và frontend 236/236 test pass
- **Security**: JWT + Bcrypt, CORS, rate limiting, input validation
- **Performance**: Caching (@tanstack/react-query), database connection pooling
- **Scalability**: Docker-ready, stateless design (session via JWT)
- **Accessibility**: WCAG compliance, keyboard navigation, screen reader support

---

## 📝 License

MIT License - vui lòng xem file LICENSE (nếu có)

---

## 💬 Liên hệ

Bất kỳ câu hỏi nào về dự án, vui lòng liên hệ hoặc mở issue trên GitHub.

---

**Last Updated**: September 2026  
**Status**: Production-ready with known considerations (see PRODUCTION_READINESS_AUDIT.md)
