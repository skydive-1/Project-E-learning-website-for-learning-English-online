const db = require('../config/database');
const { geminiModel } = require('../utils/ai-clients');

// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

/**
 * Middleware kiểm tra và giới hạn số lượng Token AI theo Role
 * Role 1 (Admin): Không giới hạn (999,999,999 tokens)
 * Role 2 (Instructor): Max 7,000 tokens / ngày
 * Role 3 (Student) & Khác: Max 6,000 tokens / ngày
 */
const checkTokenLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.user_id;
    const roleId = req.user?.roleId || req.user?.role_id || 3;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa xác thực' });
    }

    // Xác định hạn mức
    let limit = 6000; // Học viên
    if (roleId === 1) limit = 999999999; // Admin
    else if (roleId === 2) limit = 7000; // Giảng viên

    const today = getVietnamDateString();

    // Lấy thông tin hạn mức từ bảng user_token_limits
    const selectQuery = 'SELECT * FROM user_token_limits WHERE user_id = $1';
    const result = await db.query(selectQuery, [userId]);
    
    let usedTokens = 0;

    if (result.rows.length > 0) {
      const record = result.rows[0];
      const recordResetDate = record.reset_date ? new Date(record.reset_date).toISOString().split('T')[0] : '';

      if (recordResetDate !== today) {
        // Ngày mới: reset used_tokens về 0, cập nhật reset_date và max_tokens
        await db.query(
          `UPDATE user_token_limits 
           SET used_tokens = 0, max_tokens = $1, reset_date = $2, updated_at = NOW() 
           WHERE user_id = $3`,
          [limit, today, userId]
        );
        usedTokens = 0;
      } else {
        usedTokens = record.used_tokens;
        limit = record.max_tokens; // Sử dụng max_tokens thực tế trong DB
      }
    } else {
      // Chưa có record: Tạo mới
      await db.query(
        `INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date, created_at, updated_at) 
         VALUES ($1, $2, 0, $3, NOW(), NOW()) 
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, limit, today]
      );
      usedTokens = 0;
    }

    if (usedTokens >= limit) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã vượt quá hạn mức sử dụng AI hôm nay. Vui lòng thử lại vào ngày mai.'
      });
    }

    // Override res.json để đếm token sau khi có câu trả lời
    const originalJson = res.json;
    res.json = function (body) {
      // Đảm bảo chỉ gửi 1 lần
      originalJson.call(this, body);

      // Xử lý đếm token ngầm (background)
      (async () => {
        try {
          // Tính token cho câu hỏi
          const questionText = req.body.question || '';
          // body.data chứa câu trả lời từ AI trong controller
          const answerText = body?.data || '';

          if (!questionText && !answerText) return;

          // Dùng SDK đếm token
          let totalTokens = 0;

          if (questionText) {
            const reqTokens = await geminiModel.countTokens(questionText);
            totalTokens += reqTokens.totalTokens;
          }
          if (answerText && typeof answerText === 'string') {
            const resTokens = await geminiModel.countTokens(answerText);
            totalTokens += resTokens.totalTokens;
          }

          if (totalTokens > 0) {
            await db.query(
              `UPDATE user_token_limits 
               SET used_tokens = used_tokens + $1, 
                   updated_at = NOW() 
               WHERE user_id = $2 AND reset_date = $3`,
              [totalTokens, userId, today]
            );
            console.log(`[Token Limit] Đã cập nhật thêm ${totalTokens} token cho user ${userId}`);
          }
        } catch (error) {
          console.error('[Token Limit] Lỗi đếm/cập nhật token:', error);
        }
      })();
    };

    next();
  } catch (error) {
    console.error('[Token Limit Middleware Error]:', error);
    next(error);
  }
};

module.exports = {
  checkTokenLimit
};
