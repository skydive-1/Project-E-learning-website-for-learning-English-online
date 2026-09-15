const gamificationService = require('../services/gamification.service');

const getStreak = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const streakInfo = await gamificationService.calculateStreak(userId);

    return res.status(200).json({ data: streakInfo });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

const getBadges = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const badges = await gamificationService.getUserBadges(userId);
    return res.status(200).json({ badges });
  } catch (error) {
    console.error("Lỗi lấy danh sách huy hiệu:", error);
    return next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const summary = await gamificationService.getGamificationSummary(userId);
    return res.status(200).json({ data: summary });
  } catch (error) {
    console.error('Lỗi lấy tổng quan gamification:', error);
    return next(error);
  }
};

// POST /api/gamification/resync - Admin rà soát toàn bộ user (workflow tự động hóa)
const resyncAllBadges = async (req, res, next) => {
  try {
    const { limit, offset } = req.query || {};
    const result = await gamificationService.evaluateAllUsers({ limit, offset });
    return res.status(200).json({ data: result });
  } catch (error) {
    console.error('Lỗi rà soát huy hiệu toàn hệ thống:', error);
    return next(error);
  }
};

module.exports = {
  getStreak,
  getBadges,
  getSummary,
  resyncAllBadges
};
