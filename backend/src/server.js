/**
 * Main Server File - E-learning Backend (Modular Monolith)
 * Architecture: Modular Monolith
 * - Tất cả modules dùng chung 1 server
 * - Mỗi module là một đơn vị độc lập
 * - Error handling tại từng layer
 */

require('dotenv').config();
const { assertProductionEnvironment } = require('./config/environment');

// RAG Assistant và auto-subtitle đều phụ thuộc Gemini; RAG production còn cần Pinecone.
// Dừng sớm thay vì khởi động một deployment production bị thiếu secrets rồi lỗi âm thầm.
assertProductionEnvironment();

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
const mediaRoutes = require('./modules/media/media.routes');
const instructorRoutes = require('./modules/instructor/instructor.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const quizzesRoutes = require('./modules/quizzes/quizzes.routes');
const consultationRoutes = require('./modules/consultation/consultation.routes');
const analyticsRoutes = require('./modules/analytic/analytic.routes');
const gamificationRoutes = require('./modules/gamification/gamification.routes');
const commentsRoutes = require('./modules/comments/comments.routes');
const drmRoutes = require('./modules/drm/drm.routes');
const { checkShakaPackagerInstalled } = require('./utils/drmPackager.util');
const { blockDirectVideoAccess } = require('./modules/media/directVideoAccess.middleware');

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
const {
  apiLimiter,
  configureTrustProxy,
  globalLimiter
} = require('./middleware/rateLimit.middleware');

// ===== 3. KHỞI TẠO EXPRESS APP =====
const app = express();
const PORT = process.env.PORT || 5000;
configureTrustProxy(app);

// ===== 4. GLOBAL MIDDLEWARE =====

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

    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true
}));

// Rate limit every endpoint before parsing request bodies or serving files.
app.use(globalLimiter);

// Log all requests, including static/media attempts, without logging query tickets.
app.use(loggerMiddleware);

// Giới hạn payload JSON và urlencoded ở mức 10mb (điều chỉnh cho metadata khóa học lớn)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Chặn mọi định dạng video/manifest dưới /uploads. Tất cả video chỉ được đọc qua
// endpoint stream có vé; các loại tài liệu không phải video vẫn dùng static route.
app.use('/uploads', blockDirectVideoAccess);

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Apply the API-wide policy before every /api endpoint, including /api/health.
app.use('/api', apiLimiter);

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

// ===== 6. MOUNT MODULES (ROUTES) =====
// Cấu trúc: /api/<module-name>
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/consultation', consultationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/drm', drmRoutes);

// Setup Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== 7. GLOBAL ERROR HANDLER =====
// Phải là middleware cuối cùng
app.use(errorHandler);

// ===== 8. START SERVER =====
const { testConnection } = require('./config/database');
const { startMediaCleanupWorker } = require('./utils/mediaCleanup.worker');
const subtitlesService = require('./modules/lessons/services/subtitles.service');

const server = app.listen(PORT, async () => {
  // Kiểm tra kết nối Database khi khởi chạy
  const databaseReady = await testConnection();
  if (!databaseReady && process.env.NODE_ENV === 'production') {
    console.error('FATAL: Không thể kết nối PostgreSQL; dừng backend production.');
    server.close();
    return;
  }
  subtitlesService.resumePendingAutoGeneration()
    .then(count => {
      if (count > 0) console.log(`[Auto-Subtitle] Đã khôi phục ${count} job sau khi server khởi động`);
    })
    .catch(error => console.warn(`[Auto-Subtitle] Không thể khôi phục job: ${error.message}`));
  const mediaCleanupWorker = startMediaCleanupWorker();
  const shutdown = () => {
    mediaCleanupWorker?.stop();
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  // Kiểm tra Shaka Packager binary cho DRM Video Protection
  const shakaStatus = checkShakaPackagerInstalled();
  if (shakaStatus.installed) {
    console.log(`🔒 [DRM Infrastructure]: Shaka Packager đã sẵn sàng (${shakaStatus.version})`);
  } else {
    console.warn(`
    ⚠️ ═══════════════════════════════════════════════════════════════════════════ ⚠️
    [CẢNH BÁO DRM]: Shaka Packager binary CHƯA được cài đặt trên máy chủ này!
    - Video tải lên sẽ được lưu ở dạng MP4 gốc (isDrmProtected: false).
    - Xem hướng dẫn cài đặt chi tiết tại tệp: HUONG_DAN_CAI_DAT_SHAKA_PACKAGER.md
    ⚠️ ═══════════════════════════════════════════════════════════════════════════ ⚠️
    `);
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DRM_PACKAGING === 'true') {
      console.error('FATAL: ENABLE_DRM_PACKAGING=true nhưng Shaka Packager không khả dụng.');
      server.close();
      return;
    }
  }

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
  console.log('   - GET    /api/drm/license');
  console.log('   - GET    /api/health');
});

module.exports = app;
