const analyticsService = require('../services/analytic.service');

const getUserHeatmap = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id || req.query.user_id;
        const { year } = req.query;

        if (!userId) {
            return res.status(400).json({
                message: 'user_id is required'
            });
        }

        const data = await analyticsService.getUserHeatmap(userId, year);
        return res.status(200).json({ data, heatmap: data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getUserAnalyticsSummary = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id || req.query.user_id;

        if (!userId) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        const summary = await analyticsService.getUserAnalyticsSummary(userId);
        return res.status(200).json(summary);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const trackHeartbeat = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id || req.body.userId;
        const { lessonId, durationSeconds, courseId, activityType } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const result = await analyticsService.trackHeartbeat(userId, lessonId, durationSeconds);
        return res.status(200).json({
            success: true,
            message: 'Learning heartbeat recorded successfully',
            data: result
        });
    } catch (error) {
        console.error('Lỗi trackHeartbeat controller:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getUserHeatmap,
    getUserAnalyticsSummary,
    trackHeartbeat
};