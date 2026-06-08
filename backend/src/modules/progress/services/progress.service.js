/**
 * Progress Service - Nghiệp vụ quản lý tiến trình học tập
 */

class ProgressService {
  async getProgressByUserId(userId) {
    // TODO: Triển khai lấy dữ liệu tiến trình học tập thực tế từ PostgreSQL
    
    // Giả lập trả về tiến trình học tập
    return {
      userId,
      completedLessons: [1, 2],
      overallProgressPercentage: 45
    };
  }
}

module.exports = new ProgressService();
