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
