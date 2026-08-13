const gamificationService = require('../services/gamification.service');

const getStreak = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    const streakInfo = await gamificationService.calculateStreak(user_id);

    return res.status(200).json({ data: streakInfo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getStreak
};
