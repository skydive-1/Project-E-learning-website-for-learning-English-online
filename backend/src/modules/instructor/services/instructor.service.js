/**
 * Instructor Service - Nghiệp vụ quản lý cho Giảng viên (Phiên bản phi thương mại)
 */

const db = require('../../../config/database');
const fs = require('fs');
const path = require('path');

class InstructorService {
  /**
   * Lấy danh sách học viên đăng ký các khóa học của giảng viên này (hoặc toàn bộ nếu là Admin)
   * @param {number} instructorId - ID của giảng viên
   * @param {boolean} isAdmin - Cờ quyền Admin / Super Admin
   */
  async getStudents(instructorId, isAdmin = false) {
    const whereClause = isAdmin ? '' : 'WHERE c.instructor_id = $1';
    const params = isAdmin ? [] : [instructorId];

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
      ${whereClause}
      GROUP BY u.user_id, c.course_id, c.course_name
      ORDER BY u.full_name ASC;
    `;

    const result = await db.query(queryText, params);

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
   * Lấy dữ liệu hiệu suất (Performance) của giảng viên (hoặc toàn sàn nếu là Admin)
   * @param {number} instructorId - ID của giảng viên
   * @param {boolean} isAdmin - Cờ quyền Admin / Super Admin
   */
  async getPerformance(instructorId, isAdmin = false) {
    const courseWhere = isAdmin ? '' : 'WHERE instructor_id = $1';
    const courseJoinWhere = isAdmin ? '' : 'WHERE c.instructor_id = $1';
    const params = isAdmin ? [] : [instructorId];

    // 1. Tổng số khóa học của giảng viên
    const coursesCountRes = await db.query(
      `SELECT COUNT(*) as count FROM courses ${courseWhere}`,
      params
    );
    const totalCourses = parseInt(coursesCountRes.rows[0].count || 0, 10);

    // 2. Tổng số học viên duy nhất
    const studentsCountQuery = `
      SELECT COUNT(DISTINCT up.user_id) as count
      FROM user_progress up
      JOIN lessons l ON up.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      ${courseJoinWhere}
    `;
    const studentsCountRes = await db.query(studentsCountQuery, params);
    const totalStudents = parseInt(studentsCountRes.rows[0].count || 0, 10);

    // 3. Tổng lượt hoàn thành bài giảng (Thay thế cho doanh thu)
    const completionsQuery = `
      SELECT COUNT(*) as count
      FROM user_progress up
      JOIN lessons l ON up.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      ${courseJoinWhere} ${isAdmin ? 'WHERE' : 'AND'} up.is_completed = TRUE
    `;
    const completionsRes = await db.query(completionsQuery, params);
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
      ${courseJoinWhere}
      GROUP BY c.course_id, c.course_name, c.status
      ORDER BY student_count DESC;
    `;
    const courseStatsRes = await db.query(courseStatsQuery, params);

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
        ${courseJoinWhere}
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

  /**
   * Tổng hợp dữ liệu phân tích học tập theo chuẩn BoardUI cho riêng giảng viên này (hoặc toàn sàn nếu là Admin)
   * @param {number} instructorId - ID giảng viên
   * @param {number} days - Khoảng thời gian (7, 30, 90, 365)
   * @param {boolean} isAdmin - Cờ quyền Admin / Super Admin
   */
  async getAnalytics(instructorId, days = 30, isAdmin = false) {
    const safeDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
    const courseWhere = isAdmin ? '' : 'WHERE instructor_id = $1';
    const publishedCourseWhere = isAdmin ? "WHERE (status = 'published' OR status = '1')" : "WHERE instructor_id = $1 AND (status = 'published' OR status = '1')";

    const overviewQuery = `
      WITH bounds AS (
        SELECT
          CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day' AS period_start,
          CURRENT_DATE + INTERVAL '1 day' AS period_end
      ),
      instructor_courses AS (
        SELECT course_id FROM courses ${courseWhere}
      ),
      instructor_lessons AS (
        SELECT l.lesson_id
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
      ),
      instructor_quizzes AS (
        SELECT quiz_id FROM quizzes
        WHERE course_id IN (SELECT course_id FROM instructor_courses)
           OR lesson_id IN (SELECT lesson_id FROM instructor_lessons)
      ),
      period_activity AS (
        SELECT up.user_id 
        FROM user_progress up, bounds
        WHERE up.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
          AND up.updated_at >= period_start AND up.updated_at < period_end
        UNION
        SELECT qa.user_id 
        FROM quiz_attempts qa, bounds
        WHERE qa.quiz_id IN (SELECT quiz_id FROM instructor_quizzes)
          AND qa.completed_at >= period_start AND qa.completed_at < period_end
        UNION
        SELECT ls.user_id
        FROM learning_ss ls, bounds
        WHERE ls.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
          AND ls.start_at >= period_start AND ls.start_at < period_end
        UNION
        SELECT student_id AS user_id 
        FROM ai_chat, bounds
        WHERE (lesson_id IN (SELECT lesson_id FROM instructor_lessons) OR lesson_id IS NULL)
          AND created_at >= period_start AND created_at < period_end
      )
      SELECT
        (SELECT COUNT(DISTINCT up.user_id) 
         FROM user_progress up 
         WHERE up.lesson_id IN (SELECT lesson_id FROM instructor_lessons))::int AS total_learners,
        (SELECT COUNT(DISTINCT up.user_id) 
         FROM user_progress up, bounds 
         WHERE up.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
           AND up.completed_at >= period_start AND up.completed_at < period_end)::int AS new_learners,
        (SELECT COUNT(DISTINCT pa.user_id) FROM period_activity pa)::int AS active_learners,
        (SELECT COUNT(*) FROM courses WHERE instructor_id = $1 AND (status = 'published' OR status = '1'))::int AS published_courses,
        (SELECT COUNT(*) FROM instructor_lessons)::int AS total_lessons,
        (SELECT COUNT(*) FROM user_progress up, bounds
         WHERE up.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
           AND up.is_completed = true AND up.completed_at >= period_start AND up.completed_at < period_end)::int AS lessons_completed,
        (SELECT COALESCE(ROUND(SUM(LEAST(240, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(end_at, start_at) - start_at)) / 60)))::numeric, 0), 0)
         FROM learning_ss ls, bounds 
         WHERE ls.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
           AND ls.start_at >= period_start AND ls.start_at < period_end)::int AS study_minutes,
        (SELECT COALESCE(ROUND(AVG(score)::numeric, 1), 0)
         FROM quiz_attempts qa, bounds 
         WHERE qa.quiz_id IN (SELECT quiz_id FROM instructor_quizzes)
           AND qa.completed_at >= period_start AND qa.completed_at < period_end)::float AS average_quiz_score,
        (SELECT COUNT(*) FROM quiz_attempts qa, bounds
         WHERE qa.quiz_id IN (SELECT quiz_id FROM instructor_quizzes)
           AND qa.completed_at >= period_start AND qa.completed_at < period_end)::int AS quiz_attempts,
        (SELECT COUNT(*) FROM ai_chat, bounds
         WHERE (lesson_id IN (SELECT lesson_id FROM instructor_lessons) OR student_id IN (SELECT user_id FROM period_activity))
           AND created_at >= period_start AND created_at < period_end)::int AS ai_messages,
        (SELECT COALESCE(SUM(used_tokens), 0) FROM user_token_limits utl
         WHERE utl.user_id IN (
           SELECT DISTINCT up.user_id FROM user_progress up WHERE up.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
         ))::bigint AS ai_tokens_used
    `;

    const trendQuery = `
      WITH bounds AS (
        SELECT CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day' AS period_start
      ),
      instructor_lessons AS (
        SELECT l.lesson_id
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE c.instructor_id = $1
      ),
      calendar AS (
        SELECT generate_series(period_start::date, CURRENT_DATE, INTERVAL '1 day')::date AS day
        FROM bounds
      ),
      sessions AS (
        SELECT
          ls.start_at::date AS day,
          COUNT(DISTINCT ls.user_id)::int AS active_learners,
          ROUND(SUM(LEAST(240, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ls.end_at, ls.start_at) - ls.start_at)) / 60)))::numeric, 0)::int AS study_minutes
        FROM learning_ss ls, bounds
        WHERE ls.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
          AND ls.start_at >= bounds.period_start
        GROUP BY ls.start_at::date
      ),
      completions AS (
        SELECT up.completed_at::date AS day, COUNT(*)::int AS completed_lessons
        FROM user_progress up, bounds
        WHERE up.lesson_id IN (SELECT lesson_id FROM instructor_lessons)
          AND up.is_completed = true AND up.completed_at >= bounds.period_start
        GROUP BY up.completed_at::date
      )
      SELECT
        c.day,
        COALESCE(s.active_learners, 0)::int AS active_learners,
        COALESCE(s.study_minutes, 0)::int AS study_minutes,
        COALESCE(cp.completed_lessons, 0)::int AS completed_lessons,
        0::int AS new_learners
      FROM calendar c
      LEFT JOIN sessions s ON s.day = c.day
      LEFT JOIN completions cp ON cp.day = c.day
      ORDER BY c.day
    `;

    const learnersQuery = `
      WITH bounds AS (
        SELECT CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day' AS period_start
      ),
      instructor_courses AS (
        SELECT course_id, course_name FROM courses WHERE instructor_id = $1
      ),
      course_lesson_counts AS (
        SELECT s.course_id, COUNT(l.lesson_id)::int AS lesson_count
        FROM sections s
        JOIN lessons l ON l.section_id = s.section_id
        WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
        GROUP BY s.course_id
      ),
      started_courses AS (
        SELECT DISTINCT up.user_id, s.course_id
        FROM user_progress up
        JOIN lessons l ON l.lesson_id = up.lesson_id
        JOIN sections s ON s.section_id = l.section_id
        WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
        UNION
        SELECT DISTINCT ls.user_id, s.course_id
        FROM learning_ss ls
        JOIN lessons l ON l.lesson_id = ls.lesson_id
        JOIN sections s ON s.section_id = l.section_id
        WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
      ),
      learner_scope AS (
        SELECT sc.user_id, COALESCE(SUM(clc.lesson_count), 0)::int AS available_lessons
        FROM started_courses sc
        JOIN course_lesson_counts clc ON clc.course_id = sc.course_id
        GROUP BY sc.user_id
      ),
      progress AS (
        SELECT
          up.user_id,
          COUNT(*) FILTER (WHERE up.is_completed = true)::int AS completed_lessons,
          COUNT(*) FILTER (WHERE up.is_completed = true AND up.completed_at >= bounds.period_start)::int AS period_completions,
          MAX(COALESCE(up.updated_at, up.completed_at)) AS last_progress_at
        FROM user_progress up
        JOIN lessons l ON l.lesson_id = up.lesson_id
        JOIN sections s ON s.section_id = l.section_id
        CROSS JOIN bounds
        WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
        GROUP BY up.user_id
      ),
      study AS (
        SELECT
          ls.user_id,
          ROUND(SUM(LEAST(240, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ls.end_at, ls.start_at) - ls.start_at)) / 60)))::numeric, 0)::int AS study_minutes,
          MAX(ls.start_at) AS last_study_at
        FROM learning_ss ls
        JOIN lessons l ON l.lesson_id = ls.lesson_id
        JOIN sections s ON s.section_id = l.section_id
        CROSS JOIN bounds
        WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
          AND ls.start_at >= bounds.period_start
        GROUP BY ls.user_id
      ),
      quiz AS (
        SELECT
          qa.user_id,
          COUNT(*)::int AS quiz_attempts,
          ROUND(AVG(qa.score)::numeric, 1)::float AS average_quiz_score,
          MAX(qa.completed_at) AS last_quiz_at
        FROM quiz_attempts qa
        JOIN quizzes qz ON qz.quiz_id = qa.quiz_id
        CROSS JOIN bounds
        WHERE (qz.course_id IN (SELECT course_id FROM instructor_courses)
            OR qz.lesson_id IN (
              SELECT l.lesson_id 
              FROM lessons l 
              JOIN sections s ON l.section_id = s.section_id 
              WHERE s.course_id IN (SELECT course_id FROM instructor_courses)
            ))
          AND qa.completed_at >= bounds.period_start
        GROUP BY qa.user_id
      ),
      chat AS (
        SELECT student_id AS user_id, COUNT(*)::int AS ai_messages, MAX(created_at) AS last_chat_at
        FROM ai_chat, bounds
        WHERE created_at >= bounds.period_start
        GROUP BY student_id
      )
      SELECT
        u.user_id,
        u.username,
        u.full_name,
        u.email,
        u.profile_picture_url,
        u.created_date,
        COALESCE(p.completed_lessons, 0)::int AS completed_lessons,
        COALESCE(p.period_completions, 0)::int AS period_completions,
        COALESCE(ls.available_lessons, 0)::int AS available_lessons,
        CASE WHEN COALESCE(ls.available_lessons, 0) > 0
          THEN LEAST(100, ROUND(COALESCE(p.completed_lessons, 0) * 100.0 / ls.available_lessons))::int
          ELSE 0
        END AS progress_percent,
        COALESCE(st.study_minutes, 0)::int AS study_minutes,
        COALESCE(q.quiz_attempts, 0)::int AS quiz_attempts,
        COALESCE(q.average_quiz_score, 0)::float AS average_quiz_score,
        COALESCE(c.ai_messages, 0)::int AS ai_messages,
        COALESCE(utl.used_tokens, 0)::int AS used_tokens,
        GREATEST(u.last_seen_at, p.last_progress_at, st.last_study_at, q.last_quiz_at, c.last_chat_at) AS last_activity_at
      FROM users u
      JOIN learner_scope ls ON ls.user_id = u.user_id
      LEFT JOIN progress p ON p.user_id = u.user_id
      LEFT JOIN study st ON st.user_id = u.user_id
      LEFT JOIN quiz q ON q.user_id = u.user_id
      LEFT JOIN chat c ON c.user_id = u.user_id
      LEFT JOIN user_token_limits utl ON utl.user_id = u.user_id
      WHERE u.user_id IN (SELECT user_id FROM learner_scope)
      ORDER BY last_activity_at DESC NULLS LAST, progress_percent DESC
    `;

    const coursesQuery = `
      SELECT
        c.course_id,
        c.course_name,
        c.status,
        COUNT(DISTINCT up.user_id)::int AS learners,
        COUNT(DISTINCT CASE WHEN user_course_progress.completed_count = user_course_progress.total_count AND user_course_progress.total_count > 0 THEN up.user_id END)::int AS completed_learners,
        COALESCE(clc.lesson_count, 0)::int AS total_lessons,
        COALESCE(ROUND(AVG(user_course_progress.progress_percent)), 0)::int AS average_progress
      FROM courses c
      LEFT JOIN (
        SELECT s.course_id, COUNT(l.lesson_id)::int AS lesson_count
        FROM sections s
        JOIN lessons l ON l.section_id = s.section_id
        GROUP BY s.course_id
      ) clc ON clc.course_id = c.course_id
      LEFT JOIN (
        SELECT
          s.course_id,
          up.user_id,
          COUNT(*) FILTER (WHERE up.is_completed = true)::int AS completed_count,
          COUNT(l.lesson_id)::int AS total_count,
          CASE WHEN COUNT(l.lesson_id) > 0
            THEN LEAST(100, ROUND(COUNT(*) FILTER (WHERE up.is_completed = true) * 100.0 / COUNT(l.lesson_id)))::int
            ELSE 0
          END AS progress_percent
        FROM user_progress up
        JOIN lessons l ON l.lesson_id = up.lesson_id
        JOIN sections s ON s.section_id = l.section_id
        GROUP BY s.course_id, up.user_id
      ) user_course_progress ON user_course_progress.course_id = c.course_id
      LEFT JOIN user_progress up ON up.user_id = user_course_progress.user_id
      WHERE c.instructor_id = $1
      GROUP BY c.course_id, c.course_name, c.status, clc.lesson_count
      ORDER BY learners DESC
    `;

    const [overviewRes, trendRes, learnersRes, coursesRes] = await Promise.all([
      db.query(overviewQuery, [instructorId, safeDays]),
      db.query(trendQuery, [instructorId, safeDays]),
      db.query(learnersQuery, [instructorId, safeDays]),
      db.query(coursesQuery, [instructorId])
    ]);

    const now = Date.now();
    const learners = learnersRes.rows.map((row) => {
      const lastActivity = row.last_activity_at ? new Date(row.last_activity_at) : null;
      let inactiveMinutes = null;
      let inactiveDays = null;
      let engagementStatus = 'inactive';
      let isOnline = false;

      if (lastActivity) {
        const diffMs = now - lastActivity.getTime();
        inactiveMinutes = Math.max(0, Math.floor(diffMs / 60000));
        inactiveDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        if (inactiveMinutes <= 15) {
          isOnline = true;
          engagementStatus = 'online';
        } else if (inactiveDays === 0 || inactiveMinutes <= 24 * 60) {
          engagementStatus = 'active';
        } else if (inactiveDays <= 7) {
          engagementStatus = 'recent';
        } else if (inactiveDays <= 30) {
          engagementStatus = 'attention';
        } else {
          engagementStatus = 'inactive';
        }
      }

      return {
        ...row,
        is_online: isOnline,
        inactive_minutes: inactiveMinutes,
        inactive_days: inactiveDays,
        engagement_status: engagementStatus
      };
    });

    const engagement = learners.reduce(
      (acc, curr) => {
        const status = curr.engagement_status;
        if (status === 'online' || status === 'active') {
          acc.active = (acc.active || 0) + 1;
        } else if (status === 'recent') {
          acc.recent = (acc.recent || 0) + 1;
        } else if (status === 'attention') {
          acc.attention = (acc.attention || 0) + 1;
        } else {
          acc.inactive = (acc.inactive || 0) + 1;
        }
        return acc;
      },
      { active: 0, recent: 0, attention: 0, inactive: 0 }
    );

    return {
      overview: overviewRes.rows[0] || {},
      trend: trendRes.rows || [],
      learners,
      engagement,
      courses: coursesRes.rows || [],
      range: safeDays,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new InstructorService();
