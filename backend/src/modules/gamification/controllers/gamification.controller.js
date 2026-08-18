const gamificationService = require('../services/gamification.service');

const getStreak = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id || req.query.user_id;
    if (!userId) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    const streakInfo = await gamificationService.calculateStreak(userId);

    return res.status(200).json({ data: streakInfo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getBadges = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id || req.query.user_id;
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
