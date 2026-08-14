/**
 * Instructor Service - Nghiệp vụ quản lý cho Giảng viên (Phiên bản phi thương mại)
 */

const db = require('../../../config/database');
const fs = require('fs');
const path = require('path');

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

  /**
   * Xác thực thỏa thuận bản quyền và tự động gắn Watermark ẩn lên tài liệu bài giảng PDF
   */
  async acceptPolicy(instructorId, ipAddress, signature) {
    // 1. Lấy tên đầy đủ của giảng viên
    const userRes = await db.query('SELECT full_name FROM users WHERE user_id = $1', [instructorId]);
    if (userRes.rows.length === 0) {
      const error = new Error('Giảng viên không tồn tại trên hệ thống');
      error.status = 404;
      throw error;
    }
    const instructorName = userRes.rows[0].full_name;

    // 2. Lưu vết thỏa thuận vào CSDL
    const agreementQuery = `
      INSERT INTO instructor_policy_agreements (instructor_id, ip_address, signature)
      VALUES ($1, $2, $3)
      ON CONFLICT (instructor_id)
      DO UPDATE SET
        ip_address = EXCLUDED.ip_address,
        signature = EXCLUDED.signature,
        accepted_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const agreementRes = await db.query(agreementQuery, [instructorId, ipAddress, signature]);
    const agreement = agreementRes.rows[0];

    // 3. Lấy danh sách các bài học PDF của giảng viên này
    const pdfQuery = `
      SELECT l.lesson_id, l.title, l.content_url
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE c.instructor_id = $1 AND l.content_type = 'pdf';
    `;
    const pdfRes = await db.query(pdfQuery, [instructorId]);
    const pdfLessons = pdfRes.rows;

    const watermarkedLessons = [];

    // 4. Lặp qua các tài liệu PDF và đóng dấu Watermark ẩn
    for (const lesson of pdfLessons) {
      let relativePath = lesson.content_url;
      if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
        try {
          const urlObj = new URL(relativePath);
          relativePath = urlObj.pathname;
        } catch (e) {
          // Bỏ qua lỗi
        }
      }

      if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }

      // __dirname là backend/src/modules/instructor/services
      const resolvedPath = path.resolve(__dirname, '../../../../', relativePath);

      if (fs.existsSync(resolvedPath)) {
        try {
          const pdfBytes = fs.readFileSync(resolvedPath);
          const pdfDoc = await PDFDocument.load(pdfBytes);

          // Nhúng font chữ
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const pages = pdfDoc.getPages();

          for (const page of pages) {
            const { width, height } = page.getSize();

            // Text đóng dấu bản quyền chéo giữa trang (Ẩn / Mờ)
            const watermarkText = `Copyright c ${instructorName} - All Rights Reserved`;
            const fontSize = 20;
            const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);

            page.drawText(watermarkText, {
              x: (width - textWidth) / 2,
              y: height / 2,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0.6, 0.6, 0.6),
              opacity: 0.12, // Rất mờ (ẩn) để không đè tài liệu
              rotate: degrees(45),
            });

            // Footer đánh dấu bản quyền góc trái dưới trang
            page.drawText(`Licensed to E-Learn Academy | Instructor: ${instructorName}`, {
              x: 30,
              y: 20,
              size: 8,
              font: helveticaFont,
              color: rgb(0.4, 0.4, 0.4),
              opacity: 0.25,
            });
          }

          const modifiedBytes = await pdfDoc.save();
          fs.writeFileSync(resolvedPath, modifiedBytes);

          watermarkedLessons.push({
            lessonId: lesson.lesson_id,
            title: lesson.title,
            contentUrl: lesson.content_url,
            status: 'Success'
          });
        } catch (fileErr) {
          console.error(`[Watermark Error] Lỗi xử lý file lesson ${lesson.lesson_id}:`, fileErr.message);
          watermarkedLessons.push({
            lessonId: lesson.lesson_id,
            title: lesson.title,
            contentUrl: lesson.content_url,
            status: `Error: ${fileErr.message}`
          });
        }
      } else {
        watermarkedLessons.push({
          lessonId: lesson.lesson_id,
          title: lesson.title,
          contentUrl: lesson.content_url,
          status: 'File not found on server'
        });
      }
    }

    return {
      agreement,
      watermarkedCount: watermarkedLessons.filter(l => l.status === 'Success').length,
      details: watermarkedLessons
    };
  }
}

module.exports = new InstructorService();
