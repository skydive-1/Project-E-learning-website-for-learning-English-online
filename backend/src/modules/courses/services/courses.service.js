/**
 * Courses Service - Nghiệp vụ quản lý khóa học
 */

class CoursesService {
  async getAllCourses() {
    // TODO: Triển khai lấy dữ liệu khóa học thực tế từ PostgreSQL
    
    // Giả lập trả về danh sách khóa học
    return [
      { id: 1, title: 'English for Beginners', description: 'Basic English grammar and vocabulary' },
      { id: 2, title: 'Intermediate English Communication', description: 'Improve your speaking and listening skills' }
    ];
  }
}

module.exports = new CoursesService();
