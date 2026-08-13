const analyticsService = require('../services/analytic.service');

const getUserHeatmap = async (req, res) => {
    try {
        const { user_id, year } = req.query;

        if (!user_id) {
            return res.status(400).json({
                message: 'user_id is required'
            });
        }

        const data = await analyticsService.getUserHeatmap(user_id, year);

        return res.status(200).json({
            data
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getUserHeatmap
};