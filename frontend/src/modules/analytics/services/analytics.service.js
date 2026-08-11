import apiClient from '../../../config/api.config';

/**
 * Lấy dữ liệu Heatmap số phút học theo từng ngày trong năm
 * API backend: GET /api/analytics/user-heatmap
 */
export const getUserHeatmapData = async (timeRange = 'year') => {
  try {
    const response = await apiClient.get('/analytics/user-heatmap', {
      params: { range: timeRange }
    });
    if (response.data && response.data.heatmap) {
      return response.data.heatmap;
    }
  } catch (error) {
    console.warn("Sử dụng dữ liệu Heatmap mô phỏng cao cấp (Backend offline):", error.message);
  }

  // Dữ liệu mô phỏng 365 ngày cho Heatmap học tập
  const today = new Date();
  const heatmapData = [];
  
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Tạo giả lập nhịp độ học tập thực tế (vui tươi, có ngày nghỉ, ngày học hăng say)
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseRand = Math.random();
    
    let minutes = 0;
    if (baseRand > 0.35) {
      minutes = Math.floor(Math.random() * (isWeekend ? 90 : 45)) + 15;
    }

    heatmapData.push({
      date: dateStr,
      count: minutes, // Số phút học trong ngày
      intensity: minutes === 0 ? 0 : minutes < 20 ? 1 : minutes < 45 ? 2 : minutes < 75 ? 3 : 4
    });
  }

  return heatmapData;
};

/**
 * Lấy tổng quan phân tích học tập (Tổng số giờ học, % hoàn thành khóa học, Điểm trắc nghiệm)
 * API backend: GET /api/analytics/summary
 */
export const getUserAnalyticsSummary = async () => {
  try {
    const response = await apiClient.get('/analytics/summary');
    if (response.data) {
      return response.data;
    }
  } catch (error) {
    console.warn("Sử dụng dữ liệu Analytics Summary mô phỏng (Backend offline):", error.message);
  }

  // Fallback Data chuẩn EdTech Premium
  return {
    kpi: {
      totalStudyMinutes: 2550, // 42.5 giờ
      totalStudyHours: "42.5",
      completedLessonsCount: 28,
      totalQuizzesTaken: 14,
      avgQuizScorePercent: 88.5,
      currentStreakDays: 14,
      weeklyGrowthPercent: 18.4
    },
    courseCompletion: [
      { name: 'Đã hoàn thành', value: 3, color: '#10b981' },
      { name: 'Đang học', value: 2, color: '#6366f1' },
      { name: 'Chưa bắt đầu', value: 1, color: '#94a3b8' }
    ],
    skillRadar: [
      { skill: 'Phát âm (Speaking)', A: 85, fullMark: 100 },
      { skill: 'Từ vựng (Vocabulary)', A: 92, fullMark: 100 },
      { skill: 'Ngữ pháp (Grammar)', A: 78, fullMark: 100 },
      { skill: 'Kỹ năng nghe (Listening)', A: 88, fullMark: 100 },
      { skill: 'Viết tự luận (Writing)', A: 82, fullMark: 100 }
    ],
    quizTrends: [
      { week: 'Tuần 1', score: 65, attempts: 2, avgTimeMin: 12 },
      { week: 'Tuần 2', score: 72, attempts: 3, avgTimeMin: 15 },
      { week: 'Tuần 3', score: 80, attempts: 4, avgTimeMin: 18 },
      { week: 'Tuần 4', score: 85, attempts: 3, avgTimeMin: 22 },
      { week: 'Tuần 5', score: 92, attempts: 5, avgTimeMin: 25 },
      { week: 'Tuần 6', score: 88, attempts: 4, avgTimeMin: 20 },
      { week: 'Tuần 7', score: 95, attempts: 6, avgTimeMin: 28 }
    ],
    weeklyActivity: [
      { day: 'Thứ 2', minutes: 45, quizzes: 2 },
      { day: 'Thứ 3', minutes: 60, quizzes: 3 },
      { day: 'Thứ 4', minutes: 30, quizzes: 1 },
      { day: 'Thứ 5', minutes: 75, quizzes: 4 },
      { day: 'Thứ 6', minutes: 90, quizzes: 3 },
      { day: 'Thứ 7', minutes: 120, quizzes: 5 },
      { day: 'Chủ nhật', minutes: 50, quizzes: 2 }
    ]
  };
};
