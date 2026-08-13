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

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map(r => {
        const minutes = parseFloat(r.total_minutes ?? r.count ?? 0);
        // study_date là date object hoặc ISO string từ PostgreSQL
        let dStr = r.study_date || r.date;
        if (dStr) {
          dStr = typeof dStr === 'string' ? dStr.slice(0, 10) : new Date(dStr).toISOString().slice(0, 10);
        }
        return {
          date: dStr,
          count: minutes,
          intensity: minutes === 0 ? 0 : minutes < 20 ? 1 : minutes < 45 ? 2 : minutes < 75 ? 3 : 4
        };
      });
    }
  } catch (error) {
    console.error('[Analytics] Lỗi lấy heatmap:', error.message);
  }

  // Fallback: mảng rỗng (không fake data)
  return [];
};

/**
 * Lấy tổng quan phân tích học tập (KPI, charts) từ DB thật
 * API backend: GET /api/analytics/summary
 */
export const getUserAnalyticsSummary = async () => {
  try {
    const response = await apiClient.get('/analytics/summary');
    const data = response.data;

    if (data && data.kpi) {
      return data;
    }
  } catch (error) {
    console.error('[Analytics] Lỗi lấy summary:', error.message);
  }

  // Fallback trả về cấu trúc rỗng — không fake số liệu
  return {
    kpi: {
      totalStudyMinutes: 0,
      totalStudyHours: '0',
      completedLessonsCount: 0,
      totalQuizzesTaken: 0,
      avgQuizScorePercent: 0,
      currentStreakDays: 0,
      weeklyGrowthPercent: 0
    },
    courseCompletion: [
      { name: 'Đã hoàn thành', value: 0, color: '#10b981' },
      { name: 'Đang học',      value: 0, color: '#6366f1' },
      { name: 'Chưa bắt đầu', value: 0, color: '#94a3b8' }
    ],
    skillRadar: [
      { skill: 'Phát âm (Speaking)',       A: 0, fullMark: 100 },
      { skill: 'Từ vựng (Vocabulary)',     A: 0, fullMark: 100 },
      { skill: 'Ngữ pháp (Grammar)',       A: 0, fullMark: 100 },
      { skill: 'Kỹ năng nghe (Listening)', A: 0, fullMark: 100 },
      { skill: 'Viết tự luận (Writing)',   A: 0, fullMark: 100 }
    ],
    quizTrends: [],
    weeklyActivity: [
      { day: 'Thứ 2',    minutes: 0 },
      { day: 'Thứ 3',    minutes: 0 },
      { day: 'Thứ 4',    minutes: 0 },
      { day: 'Thứ 5',    minutes: 0 },
      { day: 'Thứ 6',    minutes: 0 },
      { day: 'Thứ 7',    minutes: 0 },
      { day: 'Chủ nhật', minutes: 0 }
    ]
  };
};
