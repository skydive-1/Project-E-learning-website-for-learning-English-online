const db = require('../config/database');
const { geminiModel } = require('../utils/ai-clients');

/**
 * Middleware kiểm tra và giới hạn số lượng Token AI theo Role
 * Role 1 (Admin): Không giới hạn
 * Role 2 (Instructor): Max 50,000 tokens / ngày
 * Role 3 (Student) & Khác: Max 10,000 tokens / ngày
 */
const checkTokenLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.user_id;
    const roleId = req.user?.roleId || req.user?.role_id || 3;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa xác thực' });
    }

    // Xác định hạn mức
    let limit = 10000; // Học viên
    if (roleId === 1) limit = Infinity; // Admin
    else if (roleId === 2) limit = 50000; // Giảng viên

    const today = new Date().toISOString().split('T')[0];

    // Lấy số token đã dùng hôm nay
    const query = 'SELECT used_tokens FROM user_token_usage WHERE user_id = $1 AND date = $2';
    const result = await db.query(query, [userId, today]);
    let usedTokens = 0;

    if (result.rows.length > 0) {
      usedTokens = result.rows[0].used_tokens;
    } else {
      // Nếu chưa có, tạo record mới cho ngày hôm nay
      await db.query(
        'INSERT INTO user_token_usage (user_id, date, used_tokens) VALUES ($1, $2, 0) ON CONFLICT (user_id, date) DO NOTHING',
        [userId, today]
      );
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
              'UPDATE user_token_usage SET used_tokens = used_tokens + $1 WHERE user_id = $2 AND date = $3',
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
