const {
  releaseQuestion,
  reserveQuestion
} = require('../modules/chatbot/services/aiQuestionQuota.service');

/**
 * Giới hạn số câu hỏi AI theo một cửa sổ rolling 24 giờ:
 * - Student (role 3): 10 câu hỏi
 * - Instructor (role 2): 20 câu hỏi
 * - Admin và Super Admin (role 1): không giới hạn
 */
const checkQuestionLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.user_id;
    const roleId = Number(req.user?.roleId || req.user?.role_id || 3);

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Người dùng chưa xác thực.'
      });
    }

    const quota = await reserveQuestion({ userId, roleId });
    req.aiQuestionQuota = { ...quota, userId, roleId, released: false };

    if (!quota.granted) {
      return res.status(429).json({
        success: false,
        code: 'AI_QUESTION_LIMIT_REACHED',
        message: `Bạn đã dùng hết ${quota.limit} câu hỏi AI trong 24 giờ. Hạn mức sẽ tự động mở lại vào ${new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(new Date(quota.resetAt))}.`,
        quota: {
          limit: quota.limit,
          used: quota.used,
          remaining: 0,
          resetAt: quota.resetAt
        }
      });
    }

    next();
  } catch (error) {
    console.error('[AI Question Quota Middleware Error]:', error);
    next(error);
  }
};

const releaseQuestionLimit = async (req) => {
  try {
    await releaseQuestion(req.aiQuestionQuota);
  } catch (error) {
    console.error('[AI Question Quota Release Error]:', error);
  }
};

module.exports = {
  checkQuestionLimit,
  releaseQuestionLimit
};
