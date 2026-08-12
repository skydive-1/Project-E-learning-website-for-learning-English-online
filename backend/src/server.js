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
// Mỗi module có entry point (routes.js)
const authRoutes = require('./modules/auth/auth.routes');
const coursesRoutes = require('./modules/courses/courses.routes');
const chatbotRoutes = require('./modules/chatbot/chatbot.routes');
const progressRoutes = require('./modules/progress/progress.routes');
const lessonsRoutes = require('./modules/lessons/lessons.routes');
const instructorRoutes = require('./modules/instructor/instructor.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const quizzesRoutes = require('./modules/quizzes/quizzes.routes');
const consultationRoutes = require('./modules/consultation/consultation.routes');
const commentsRoutes = require('./modules/comments/comments.routes');

// ===== SWAGGER =====
const swaggerSpec = require('./swagger');
const swaggerUi = require('swagger-ui-express');

// Ràng buộc bảo mật: JWT_SECRET là bắt buộc để khởi chạy ứng dụng an toàn
if (!process.env.JWT_SECRET) {
  console.error('\n❌ FATAL ERROR: JWT_SECRET không được định nghĩa trong biến môi trường.');
  console.error('Hệ thống dừng khởi động để đảm bảo an ninh.\n');
  process.exit(1);
}

// ===== 2. IMPORT MIDDLEWARE =====
const errorHandler = require('./middleware/error.middleware');
const loggerMiddleware = require('./middleware/logger.middleware');

// ===== 3. KHỞI TẠO EXPRESS APP =====
const app = express();
const PORT = process.env.PORT || 5000;

// Tin tưởng proxy để lấy IP thật của client qua headers (Render, Heroku, Nginx, Cloudflare...)
app.set('trust proxy', 1);

// ===== 4. GLOBAL MIDDLEWARE =====
// Import rate limiters
const { globalLimiter } = require('./middleware/rateLimit.middleware');

app.use(cors({
  origin: (origin, callback) => {
    // Trong phát triển (development) hoặc không có origin (curl, mobile app), cho phép kết nối
    if (!origin || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    const cleanOrigin = origin.replace(/\/+$/, '');
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map(url => url.trim().replace(/\/+$/, ''));

    // Cho phép nếu có trong danh sách FRONTEND_URL hoặc là bất kỳ domain Vercel nào (*.vercel.app)
    if (allowedOrigins.includes(cleanOrigin) || cleanOrigin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true
}));

// Giới hạn payload JSON và urlencoded ở mức 10mb (điều chỉnh cho metadata khóa học lớn)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Bảo vệ thư mục video khóa học, chặn tải trực tiếp qua static URL
app.use('/uploads/courses/videos', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Quyền truy cập bị từ chối: Không được phép tải trực tiếp tệp video của khóa học.'
  });
});

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging middleware
app.use(loggerMiddleware);

// ===== 5. HEALTH CHECK ENDPOINTS =====
const healthHandler = (req, res) => {
  res.json({
    status: 'OK',
    message: 'E-learning backend is running',
    timestamp: new Date().toISOString()
  });
};

app.get('/', healthHandler);
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Áp dụng Rate Limit chung cho tất cả các API endpoints
app.use('/api', globalLimiter);

// ===== 6. MOUNT MODULES (ROUTES) =====
// Cấu trúc: /api/<module-name>
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/consultation', consultationRoutes);
app.use('/api/comments', commentsRoutes);

// Setup Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== 7. GLOBAL ERROR HANDLER =====
// Phải là middleware cuối cùng
app.use(errorHandler);

// ===== 8. START SERVER =====
const { testConnection } = require('./config/database');

app.listen(PORT, async () => {
  // Kiểm tra kết nối Database khi khởi chạy
  await testConnection();

  console.log(`
    ╔═══════════════════════════════════════════╗
    ║   🚀 E-LEARNING BACKEND SERVER STARTED   ║
    ║   🌐 http://localhost:${PORT}/api-docs    ║
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
