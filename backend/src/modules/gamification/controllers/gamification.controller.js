const gamificationService = require('../services/gamification.service');

const getStreak = async (req, res) => {
  try {
    const userId = req.user.id;
    const streakInfo = await gamificationService.calculateStreak(userId);

    return res.status(200).json({ data: streakInfo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getBadges = async (req, res) => {
  try {
    const userId = req.user.id;
    const badges = await gamificationService.getUserBadges(userId);
    return res.status(200).json({ badges });
  } catch (error) {
    console.error("Lỗi lấy danh sách huy hiệu:", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getStreak,
  getBadges
};
