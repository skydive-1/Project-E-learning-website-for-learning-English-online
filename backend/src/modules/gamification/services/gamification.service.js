const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_TIMEZONE_OFFSET = 7 * 60 * 60 * 1000;

const BADGE_DEFINITIONS = [
  {
    id: 'first_lesson',
    title: 'Khởi đầu nan',
    description: 'Hoàn thành bài học đầu tiên',
    requirement: 'Hoàn thành ít nhất 1 bài học (user_progress.is_completed = TRUE)',
    icon: '🌱'
  },
  {
    id: 'streak_3',
    title: 'Chiến binh kiên trì',
    description: 'Đạt chuỗi học 3 ngày liên tiếp',
    requirement: 'Học 3 ngày liên tiếp (Asia/Ho_Chi_Minh, từ learning_ss)',
    icon: '🔥'
  },
  {
    id: 'streak_7',
    title: 'Thói quen vàng',
    description: 'Đạt chuỗi học 7 ngày liên tiếp',
    requirement: 'Học 7 ngày liên tiếp (Asia/Ho_Chi_Minh, từ learning_ss)',
    icon: '⚡'
  },
  {
    id: 'streak_30',
    title: 'Bậc thầy kỷ luật',
    description: 'Đạt chuỗi học 30 ngày liên tiếp',
    requirement: 'Học 30 ngày liên tiếp (Asia/Ho_Chi_Minh, từ learning_ss)',
    icon: '👑'
  },
  {
    id: 'quiz_master',
    title: 'Vua trắc nghiệm',
    description: 'Đạt điểm tuyệt đối trong 5 bài Quiz khác nhau',
    requirement: 'Đạt score = 100 ở 5 quiz_id khác nhau (quiz_attempts)',
    icon: '🎯'
  },
  {
    id: 'ai_interactive',
    title: 'Tương tác thông minh',
    description: 'Đặt 10 câu hỏi cho AI Chatbot',
    requirement: 'Gửi 10 tin nhắn user cho AI Chatbot (ai_chat.sender_type = user)',
    icon: '🤖'
  },
  {
    id: 'grammar_guru',
    title: 'Bậc thầy Ngữ pháp',
    description: 'Hoàn thành các bài học trong khóa Ngữ pháp đã bắt đầu',
    requirement: 'Hoàn thành 100% bài học Ngữ pháp thuộc khóa đã bắt đầu',
    icon: '📚'
  },
  {
    id: 'speed_learner',
    title: 'Tốc độ ánh sáng',
    description: 'Hoàn thành 3 bài học trong cùng một ngày',
    requirement: 'Hoàn thành 3 bài học trong cùng 1 ngày (Asia/Ho_Chi_Minh)',
    icon: '🚀'
  }
];

const parseUserId = userId => {
  const parsed = Number.parseInt(userId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error('Người dùng chưa được xác thực');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  return parsed;
};

const getVietnamDateStr = (date = new Date()) => (
  new Date(date.getTime() + VN_TIMEZONE_OFFSET).toISOString().slice(0, 10)
);

const normalizeDay = value => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const shiftDay = (day, amount) => {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const analyzeActivityDays = (rawDays, now = new Date()) => {
  const days = [...new Set((rawDays || []).map(normalizeDay).filter(Boolean))].sort();
  const daySet = new Set(days);
  const today = getVietnamDateStr(now);
  const yesterday = shiftDay(today, -1);
  const currentAnchor = daySet.has(today) ? today : (daySet.has(yesterday) ? yesterday : null);

  let currentStreak = 0;
  if (currentAnchor) {
    let cursor = currentAnchor;
    while (daySet.has(cursor)) {
      currentStreak += 1;
      cursor = shiftDay(cursor, -1);
    }
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDay = null;
  const thresholdDates = {};

  days.forEach(day => {
    runningStreak = previousDay && shiftDay(previousDay, 1) === day
      ? runningStreak + 1
      : 1;
    previousDay = day;
    longestStreak = Math.max(longestStreak, runningStreak);

    [3, 7, 30].forEach(threshold => {
      if (runningStreak >= threshold && !thresholdDates[threshold]) {
        thresholdDates[threshold] = day;
      }
    });
  });

  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const dayOfWeek = todayDate.getUTCDay();
  const monday = shiftDay(today, dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const weekLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const weeklyStatus = weekDays.map((day, index) => {
    const date = shiftDay(monday, index);
    return {
      day,
      label: weekLabels[index],
      date,
      active: daySet.has(date)
    };
  });

  return {
    currentStreak,
    longestStreak,
    weeklyStatus,
    lastActivityDate: days.at(-1) || null,
    thresholdDates
  };
};

const loadActivityDays = async userId => {
  const result = await db.query(`
    SELECT DISTINCT
      timezone('Asia/Ho_Chi_Minh', start_at AT TIME ZONE 'UTC')::date AS day
    FROM learning_ss
    WHERE user_id = $1
      AND end_at IS NOT NULL
    ORDER BY day ASC
  `, [userId]);
  return result.rows.map(row => row.day);
};

const calculateStreak = async userId => {
  const cleanUserId = parseUserId(userId);

  try {
    const activityDays = await loadActivityDays(cleanUserId);
    const analysis = analyzeActivityDays(activityDays);

    return {
      user_id: cleanUserId,
      streak: analysis.currentStreak,
      currentStreak: analysis.currentStreak,
      longestStreak: analysis.longestStreak,
      weeklyStatus: analysis.weeklyStatus,
      last_activity_date: analysis.lastActivityDate,
      thresholdDates: analysis.thresholdDates
    };
  } catch (error) {
    handleServiceError(error, 'Lỗi khi tính streak gamification');
  }
};

const loadBadgeMetrics = async userId => {
  const result = await db.query(`
    WITH completed_progress AS (
      SELECT
        up.lesson_id,
        up.completed_at,
        timezone('Asia/Ho_Chi_Minh', up.completed_at AT TIME ZONE 'UTC')::date AS completion_day
      FROM user_progress up
      WHERE up.user_id = $1
        AND up.is_completed = TRUE
        AND up.completed_at IS NOT NULL
    ),
    started_courses AS (
      SELECT DISTINCT s.course_id
      FROM user_progress up
      JOIN lessons l ON l.lesson_id = up.lesson_id
      JOIN sections s ON s.section_id = l.section_id
      WHERE up.user_id = $1
    ),
    grammar_scope AS (
      SELECT DISTINCT l.lesson_id
      FROM lessons l
      JOIN sections s ON s.section_id = l.section_id
      JOIN courses c ON c.course_id = s.course_id
      JOIN subjects subject ON subject.subject_id = c.subject_id
      JOIN started_courses started ON started.course_id = c.course_id
      WHERE subject.subject_id = 5
         OR subject.subject_name ILIKE '%grammar%'
    ),
    perfect_quizzes AS (
      SELECT
        qa.quiz_id,
        MIN(timezone('Asia/Ho_Chi_Minh', qa.completed_at AT TIME ZONE 'UTC')::date) AS perfect_day
      FROM quiz_attempts qa
      WHERE qa.user_id = $1
        AND qa.score = 100
      GROUP BY qa.quiz_id
    ),
    user_ai_questions AS (
      SELECT
        ac.ai_chat,
        timezone('Asia/Ho_Chi_Minh', ac.created_at AT TIME ZONE 'UTC')::date AS question_day,
        ROW_NUMBER() OVER (ORDER BY ac.created_at ASC, ac.ai_chat ASC) AS question_number
      FROM ai_chat ac
      WHERE ac.student_id = $1
        AND ac.sender_type = 'user'
    ),
    daily_completions AS (
      SELECT completion_day, COUNT(*)::int AS completed_count
      FROM completed_progress
      GROUP BY completion_day
    )
    SELECT
      (SELECT COUNT(*)::int FROM completed_progress) AS completed_lessons,
      (SELECT MIN(completion_day) FROM completed_progress) AS first_lesson_day,
      (SELECT COUNT(*)::int FROM perfect_quizzes) AS perfect_quizzes,
      (SELECT perfect_day FROM perfect_quizzes ORDER BY perfect_day, quiz_id OFFSET 4 LIMIT 1) AS quiz_master_day,
      (SELECT COUNT(*)::int FROM user_ai_questions) AS ai_questions,
      (SELECT question_day FROM user_ai_questions WHERE question_number = 10) AS ai_interactive_day,
      (SELECT COUNT(*)::int FROM grammar_scope) AS grammar_total,
      (
        SELECT COUNT(*)::int
        FROM grammar_scope grammar
        JOIN completed_progress completed ON completed.lesson_id = grammar.lesson_id
      ) AS grammar_completed,
      (
        SELECT MAX(completed.completion_day)
        FROM grammar_scope grammar
        JOIN completed_progress completed ON completed.lesson_id = grammar.lesson_id
      ) AS grammar_completed_day,
      COALESCE((SELECT MAX(completed_count) FROM daily_completions), 0)::int AS max_daily_completions,
      (
        SELECT completion_day
        FROM daily_completions
        WHERE completed_count >= 3
        ORDER BY completion_day ASC
        LIMIT 1
      ) AS speed_learner_day
  `, [userId]);

  const row = result.rows[0] || {};
  return {
    completedLessons: Number(row.completed_lessons || 0),
    firstLessonDay: normalizeDay(row.first_lesson_day),
    perfectQuizzes: Number(row.perfect_quizzes || 0),
    quizMasterDay: normalizeDay(row.quiz_master_day),
    aiQuestions: Number(row.ai_questions || 0),
    aiInteractiveDay: normalizeDay(row.ai_interactive_day),
    grammarTotal: Number(row.grammar_total || 0),
    grammarCompleted: Number(row.grammar_completed || 0),
    grammarCompletedDay: normalizeDay(row.grammar_completed_day),
    maxDailyCompletions: Number(row.max_daily_completions || 0),
    speedLearnerDay: normalizeDay(row.speed_learner_day)
  };
};

const buildBadges = (metrics, streakInfo) => {
  const longestStreak = Number(streakInfo.longestStreak || 0);
  const grammarUnlocked = metrics.grammarTotal > 0
    && metrics.grammarCompleted >= metrics.grammarTotal;

  const states = {
    first_lesson: {
      unlocked: metrics.completedLessons >= 1,
      unlockedAt: metrics.firstLessonDay,
      progress: { current: metrics.completedLessons, target: 1, unit: 'bài học' }
    },
    streak_3: {
      unlocked: longestStreak >= 3,
      unlockedAt: normalizeDay(streakInfo.thresholdDates?.[3]),
      progress: { current: longestStreak, target: 3, unit: 'ngày' }
    },
    streak_7: {
      unlocked: longestStreak >= 7,
      unlockedAt: normalizeDay(streakInfo.thresholdDates?.[7]),
      progress: { current: longestStreak, target: 7, unit: 'ngày' }
    },
    streak_30: {
      unlocked: longestStreak >= 30,
      unlockedAt: normalizeDay(streakInfo.thresholdDates?.[30]),
      progress: { current: longestStreak, target: 30, unit: 'ngày' }
    },
    quiz_master: {
      unlocked: metrics.perfectQuizzes >= 5,
      unlockedAt: metrics.quizMasterDay,
      progress: { current: metrics.perfectQuizzes, target: 5, unit: 'quiz' }
    },
    ai_interactive: {
      unlocked: metrics.aiQuestions >= 10,
      unlockedAt: metrics.aiInteractiveDay,
      progress: { current: metrics.aiQuestions, target: 10, unit: 'câu hỏi' }
    },
    grammar_guru: {
      unlocked: grammarUnlocked,
      unlockedAt: grammarUnlocked ? metrics.grammarCompletedDay : null,
      progress: {
        current: metrics.grammarCompleted,
        target: metrics.grammarTotal,
        unit: 'bài học',
        available: metrics.grammarTotal > 0
      }
    },
    speed_learner: {
      unlocked: metrics.maxDailyCompletions >= 3,
      unlockedAt: metrics.speedLearnerDay,
      progress: { current: metrics.maxDailyCompletions, target: 3, unit: 'bài/ngày' }
    }
  };

  return BADGE_DEFINITIONS.map(definition => ({
    ...definition,
    desc: definition.description,
    ...states[definition.id]
  }));
};

const getGamificationSummary = async userId => {
  const cleanUserId = parseUserId(userId);

  try {
    const [streak, metrics] = await Promise.all([
      calculateStreak(cleanUserId),
      loadBadgeMetrics(cleanUserId)
    ]);

    return {
      streak,
      badges: buildBadges(metrics, streak)
    };
  } catch (error) {
    handleServiceError(error, 'Lỗi khi lấy dữ liệu gamification');
  }
};

const getUserBadges = async userId => {
  const summary = await getGamificationSummary(userId);
  return summary.badges;
};

/**
 * Rà soát điều kiện huy hiệu cho toàn bộ user từ dữ liệu học tập thật.
 * Dùng cho workflow tự động hóa: admin gọi định kỳ hoặc sau deploy để đảm bảo
 * mọi user đủ điều kiện đều được ghi nhận unlocked (tính live, không mock).
 * Giới hạn batch để giữ kiến trúc 0 VND một instance (tránh OOM/quota).
 */
const evaluateAllUsers = async ({ limit = 200, offset = 0 } = {}) => {
  const cleanLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 200, 1), 1000);
  const cleanOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const usersResult = await db.query(
    'SELECT user_id FROM users ORDER BY user_id ASC LIMIT $1 OFFSET $2',
    [cleanLimit, cleanOffset]
  );

  const perUser = [];
  const unlockedCounts = {};
  BADGE_DEFINITIONS.forEach(definition => {
    unlockedCounts[definition.id] = 0;
  });

  for (const row of usersResult.rows) {
    const userId = row.user_id;
    const summary = await getGamificationSummary(userId);
    const unlocked = summary.badges
      .filter(badge => badge.unlocked)
      .map(badge => ({ id: badge.id, unlockedAt: badge.unlockedAt || null }));
    unlocked.forEach(entry => {
      unlockedCounts[entry.id] = (unlockedCounts[entry.id] || 0) + 1;
    });
    perUser.push({ user_id: userId, unlocked, unlockedCount: unlocked.length });
  }

  return {
    scanned: perUser.length,
    limit: cleanLimit,
    offset: cleanOffset,
    unlockedCounts,
    users: perUser
  };
};

module.exports = {
  BADGE_DEFINITIONS,
  calculateStreak,
  getUserBadges,
  getGamificationSummary,
  evaluateAllUsers,
  analyzeActivityDays
};
