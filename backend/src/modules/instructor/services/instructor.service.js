/**
 * Instructor Service - Nghiệp vụ quản lý cho Giảng viên (Phiên bản phi thương mại)
 */

const db = require('../../../config/database');

class InstructorService {
  /**
   * Lấy danh sách học viên đăng ký các khóa học của giảng viên này
   * @param {number} instructorId - ID của giảng viên
   */
  async getStudents(instructorId) {
    // Truy vấn thông tin học viên kèm theo khóa học và tiến độ hoàn thành bài giảng
    const queryText = `
      SELECT 
        u.user_id, 
        u.username, 
        u.full_name, 
        u.email, 
        u.phone, 
        u.gender, 
        u.profile_picture_url, 
        u.created_date as join_date,
        c.course_id, 
        c.course_name,
        -- Đếm tổng số bài học trong khóa học
        (
          SELECT COUNT(l2.lesson_id)
          FROM lessons l2
          JOIN sections s2 ON l2.section_id = s2.section_id
          WHERE s2.course_id = c.course_id
        ) as total_lessons,
        -- Đếm số bài học mà học viên đã hoàn thành trong khóa học
        COUNT(DISTINCT CASE WHEN up.is_completed = TRUE THEN l.lesson_id END) as completed_lessons
      FROM users u
      JOIN user_progress up ON u.user_id = up.user_id
      JOIN lessons l ON up.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE c.instructor_id = $1
      GROUP BY u.user_id, c.course_id, c.course_name
      ORDER BY u.full_name ASC;
    `;
    
    const result = await db.query(queryText, [instructorId]);
    
    // Tính toán tỷ lệ phần trăm tiến độ của học viên
    return result.rows.map(row => {
      const total = parseInt(row.total_lessons || 0, 10);
      const completed = parseInt(row.completed_lessons || 0, 10);
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        userId: row.user_id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        gender: row.gender,
        profilePictureUrl: row.profile_picture_url,
        joinDate: row.join_date,
        courseId: row.course_id,
        courseName: row.course_name,
        progress: progressPercent,
        completedLessons: completed,
        totalLessons: total
      };
    });
  }

  /**
   * Lấy dữ liệu hiệu suất (Performance) của giảng viên - Phiên bản phi thương mại
   * @param {number} instructorId - ID của giảng viên
   */
  async getPerformance(instructorId) {
    // 1. Tổng số khóa học của giảng viên
    const coursesCountRes = await db.query(
      'SELECT COUNT(*) as count FROM courses WHERE instructor_id = $1',
      [instructorId]
    );
    const totalCourses = parseInt(coursesCountRes.rows[0].count || 0, 10);

    // 2. Tổng số học viên duy nhất
    const studentsCountQuery = `
      SELECT COUNT(DISTINCT up.user_id) as count
      FROM user_progress up
      JOIN lessons l ON up.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE c.instructor_id = $1
    `;
    const studentsCountRes = await db.query(studentsCountQuery, [instructorId]);
    const totalStudents = parseInt(studentsCountRes.rows[0].count || 0, 10);

    // 3. Tổng lượt hoàn thành bài giảng (Thay thế cho doanh thu)
    const completionsQuery = `
      SELECT COUNT(*) as count
      FROM user_progress up
      JOIN lessons l ON up.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE c.instructor_id = $1 AND up.is_completed = TRUE
    `;
    const completionsRes = await db.query(completionsQuery, [instructorId]);
    const totalCompletions = parseInt(completionsRes.rows[0].count || 0, 10);

    // 4. Thống kê chi tiết theo từng khóa học (Số chương, số bài học, số học viên, số lượt học xong)
    const courseStatsQuery = `
      SELECT 
        c.course_id,
        c.course_name,
        c.status,
        (SELECT COUNT(*) FROM sections s2 WHERE s2.course_id = c.course_id) as sections_count,
        (SELECT COUNT(*) FROM lessons l2 JOIN sections s3 ON l2.section_id = s3.section_id WHERE s3.course_id = c.course_id) as lessons_count,
        COUNT(DISTINCT up.user_id) as student_count,
        COUNT(DISTINCT CASE WHEN up.is_completed = TRUE THEN up.progress_id END) as completed_lessons_count
      FROM courses c
      LEFT JOIN sections s ON c.course_id = s.course_id
      LEFT JOIN lessons l ON s.section_id = l.section_id
      LEFT JOIN user_progress up ON l.lesson_id = up.lesson_id
      WHERE c.instructor_id = $1
      GROUP BY c.course_id, c.course_name, c.status
      ORDER BY student_count DESC;
    `;
    const courseStatsRes = await db.query(courseStatsQuery, [instructorId]);
    
    // 5. Thống kê học viên mới đăng ký theo tháng
    const monthlyStatsQuery = `
      SELECT 
        TO_CHAR(min_date, 'YYYY-MM') as month,
        COUNT(*) as enrollments_count
      FROM (
        SELECT 
          up.user_id, 
          c.course_id, 
          MIN(up.completed_at) as min_date
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.lesson_id
        JOIN sections s ON l.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE c.instructor_id = $1
        GROUP BY up.user_id, c.course_id
      ) enrollments
      GROUP BY TO_CHAR(min_date, 'YYYY-MM')
      ORDER BY month ASC;
    `;
    const monthlyStatsRes = await db.query(monthlyStatsQuery, [instructorId]);

    return {
      overview: {
        totalCourses,
        totalStudents,
        totalCompletions,
        ratingAverage: 4.8
      },
      courses: courseStatsRes.rows.map(row => ({
        courseId: row.course_id,
        courseName: row.course_name,
        status: row.status,
        sectionsCount: parseInt(row.sections_count || 0, 10),
        lessonsCount: parseInt(row.lessons_count || 0, 10),
        studentCount: parseInt(row.student_count || 0, 10),
        completedLessonsCount: parseInt(row.completed_lessons_count || 0, 10)
      })),
      monthlyData: monthlyStatsRes.rows.map(row => ({
        month: row.month,
        enrollments: parseInt(row.enrollments_count || 0, 10)
      }))
    };
  }
}

module.exports = new InstructorService();
