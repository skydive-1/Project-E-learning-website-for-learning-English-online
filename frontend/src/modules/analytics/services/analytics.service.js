import apiClient from '../../../config/api.config';

/**
 * Lấy dữ liệu Heatmap số phút học theo từng ngày trong năm
 * API backend: GET /api/analytics/user-heatmap
 * Trả về mảng 365 phần tử: { date, count, intensity }
 */
export const getUserHeatmapData = async (timeRange = 'year') => {
  try {
    const response = await apiClient.get('/analytics/user-heatmap', {
      params: { range: timeRange }
    });

    // Backend trả về { data: [...], heatmap: [...] } hoặc mảng trực tiếp
    const rows = response.data?.data || response.data?.heatmap || response.data;

    if (Array.isArray(rows)) {
      return rows.map(r => {
        const minutes = Math.round(parseFloat(r.total_minutes ?? r.count ?? 0) * 10) / 10;
        // study_date là date object hoặc ISO string từ PostgreSQL
        let dStr = r.study_date || r.date;
        if (dStr) {
          dStr = typeof dStr === 'string' ? dStr.slice(0, 10) : new Date(dStr).toISOString().slice(0, 10);
        }
        return {
          date: dStr,
          count: minutes,
          intensity: minutes === 0 ? 0 : minutes <= 15 ? 1 : minutes <= 30 ? 2 : minutes <= 60 ? 3 : 4
        };
      });
    }
    throw new Error('Phản hồi heatmap từ máy chủ không đúng định dạng.');
  } catch (error) {
    console.error('[Analytics] Lỗi lấy heatmap:', error.message);
    throw error;
  }
};

/**
 * Gửi heartbeat ghi nhận thời gian học thực tế lên máy chủ (Real-time Learning Tracker)
 * @param {number|string} lessonId
 * @param {number} durationSeconds - Số giây thực tế tích lũy trong nhịp này (mặc định 30s)
 * @param {string} activityType - 'video' | 'pdf' | 'speaking' | 'quiz'
 */
export const sendStudyHeartbeat = async (lessonId, durationSeconds = 30, activityType = 'video') => {
  try {
    const cleanLessonId = lessonId ? parseInt(String(lessonId).replace('quiz-', '').replace('speaking-', ''), 10) : null;
    const response = await apiClient.post('/analytics/heartbeat', {
      lessonId: cleanLessonId,
      durationSeconds,
      activityType
    });
    return response.data;
  } catch (error) {
    console.error('[Analytics] Study heartbeat failed:', error);
    return null;
  }
};

/**
 * Lấy tổng quan phân tích học tập (KPI, charts) từ DB thật
 * API backend: GET /api/analytics/summary
 */
export const getUserAnalyticsSummary = async () => {
  try {
    const response = await apiClient.get('/analytics/summary');
    const data = response.data;

    if (!data || !data.kpi) throw new Error('Phản hồi analytics từ máy chủ không đúng định dạng.');
    return data;
  } catch (error) {
    console.error('[Analytics] Lỗi lấy summary:', error.message);
    throw error;
  }
};
