import writeExcelFile from 'write-excel-file/universal';

// ==========================================
// 1. STYLING TOKENS FOR EXCEL WORKBOOKS
// ==========================================

export const EXCEL_HEADER_STYLE = {
  fontWeight: 'bold',
  backgroundColor: '#1E293B', // Slate 800 (Dark Luxury Slate)
  textColor: '#FFFFFF',
  borderColor: '#0F172A',
  borderStyle: 'thin',
  align: 'center',
  alignVertical: 'center',
  height: 30
};

export const EXCEL_BORDER_COLOR = '#CBD5E1'; // Slate 300 - clear, elegant gridlines

export const EXCEL_BASE_CELL = {
  borderColor: EXCEL_BORDER_COLOR,
  borderStyle: 'thin',
  alignVertical: 'center',
  height: 22
};

export const getQuotaStatusStyle = (status) => {
  switch (status) {
    case 'normal':
      return { backgroundColor: '#ECFDF5', textColor: '#065F46' }; // Soft emerald
    case 'warning':
      return { backgroundColor: '#FFFBEB', textColor: '#92400E' }; // Soft amber
    case 'critical':
    case 'exhausted':
      return { backgroundColor: '#FEF2F2', textColor: '#991B1B' }; // Soft rose
    case 'unlimited':
      return { backgroundColor: '#EEF2FF', textColor: '#3730A3' }; // Soft indigo
    case 'unused':
    default:
      return { backgroundColor: '#F1F5F9', textColor: '#475569' }; // Soft slate
  }
};

export const getLearnerStatusStyle = (status) => {
  switch (status) {
    case 'active':
      return { backgroundColor: '#ECFDF5', textColor: '#065F46' };
    case 'attention':
      return { backgroundColor: '#FFFBEB', textColor: '#92400E' };
    case 'inactive':
      return { backgroundColor: '#FEF2F2', textColor: '#991B1B' };
    default:
      return { backgroundColor: '#F1F5F9', textColor: '#475569' };
  }
};

export const formatReadableDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

export const downloadExcelBlob = (blob, fileName) => {
  if (typeof window === 'undefined') return;
  const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ==========================================
// 2. AI QUOTA USAGE REPORT EXPORT (.xlsx)
// ==========================================

export const AI_QUOTA_EXCEL_COLUMNS = [
  { width: 8 },  // STT
  { width: 14 }, // ID người dùng
  { width: 26 }, // Họ tên
  { width: 20 }, // Tên đăng nhập
  { width: 32 }, // Email
  { width: 22 }, // Vai trò
  { width: 18 }, // Token đã dùng
  { width: 18 }, // Hạn mức tối đa
  { width: 22 }, // Phần trăm đã dùng (%)
  { width: 18 }, // Lượt hỏi hôm nay
  { width: 24 }, // Hạn mức câu hỏi/ngày
  { width: 18 }, // Số câu hỏi còn lại
  { width: 22 }, // Thời điểm đặt lại
  { width: 20 }, // Trạng thái hạn mức
  { width: 22 }  // Tương tác gần nhất
];

export const buildAiQuotaExcelData = (users, t = (s) => s) => {
  const headers = [
    t('STT'),
    t('ID người dùng'),
    t('Họ tên'),
    t('Tên đăng nhập'),
    'Email',
    t('Vai trò'),
    t('Token đã dùng'),
    t('Hạn mức tối đa'),
    t('Phần trăm đã dùng (%)'),
    t('Lượt hỏi hôm nay'),
    t('Hạn mức câu hỏi/ngày'),
    t('Số câu hỏi còn lại'),
    t('Thời điểm đặt lại'),
    t('Trạng thái hạn mức'),
    t('Tương tác gần nhất')
  ].map((title) => ({ value: title, ...EXCEL_HEADER_STYLE }));

  const statusLabels = {
    exhausted: t('Đã hết hạn mức'),
    critical: t('Sắp hết hạn mức'),
    warning: t('Cảnh báo'),
    normal: t('Bình thường'),
    unused: t('Chưa sử dụng'),
    unlimited: t('Không giới hạn')
  };

  const rows = users.map((user, index) => {
    const isAdmin = Number(user.role_id) === 1;
    const isUnlimited = Boolean(user.question_quota_unlimited) && !isAdmin;
    const usedQuestions = Number(user.used_questions_24h || 0);
    const questionLimit = isUnlimited
      ? null
      : Number(user.question_limit_24h || (isAdmin ? 50 : Number(user.role_id) === 2 ? 20 : 10));
    const remainingQuestions = isUnlimited
      ? null
      : Number(user.questions_remaining_24h ?? Math.max(0, questionLimit - usedQuestions));
    const tokenLimit = Number(user.max_tokens || 250000);
    const usedTokens = Number(user.used_tokens || 0);
    const tokenPercentage = Number(user.usage_percentage ?? Math.min(100, Math.round((usedTokens / tokenLimit) * 100)));
    const role = isAdmin
      ? t('Quản trị viên hệ thống')
      : Number(user.role_id) === 2 ? t('Giảng viên hệ thống') : t('Học viên hệ thống');

    const rowBg = index % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
    const rowBase = { ...EXCEL_BASE_CELL, backgroundColor: rowBg };

    const statusKey = user.question_quota_status || 'normal';
    const statusLabel = statusLabels[statusKey] || statusKey;
    const statusStyle = getQuotaStatusStyle(statusKey);

    return [
      { value: index + 1, type: Number, ...rowBase, align: 'center' },
      { value: Number(user.user_id) || user.user_id, type: Number, ...rowBase, align: 'center' },
      { value: String(user.full_name || ''), ...rowBase, align: 'left', fontWeight: 'bold' },
      { value: String(user.username || ''), ...rowBase, align: 'left' },
      { value: String(user.email || ''), ...rowBase, align: 'left' },
      { value: role, ...rowBase, align: 'center' },
      { value: usedTokens, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      { value: tokenLimit, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      { value: Number((tokenPercentage / 100).toFixed(4)), type: Number, format: '0%', ...rowBase, align: 'right' },
      isUnlimited
        ? { value: t('Không giới hạn'), ...rowBase, align: 'center', backgroundColor: '#EEF2FF', textColor: '#3730A3' }
        : { value: usedQuestions, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      isUnlimited
        ? { value: t('Không giới hạn'), ...rowBase, align: 'center', backgroundColor: '#EEF2FF', textColor: '#3730A3' }
        : { value: questionLimit, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      isUnlimited
        ? { value: t('Không giới hạn'), ...rowBase, align: 'center', backgroundColor: '#EEF2FF', textColor: '#3730A3' }
        : { value: remainingQuestions, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      { value: formatReadableDate(user.question_reset_at), ...rowBase, align: 'center' },
      { value: statusLabel, ...EXCEL_BASE_CELL, ...statusStyle, align: 'center', fontWeight: 'bold' },
      { value: formatReadableDate(user.last_ai_activity_at), ...rowBase, align: 'center' }
    ];
  });

  return [headers, ...rows];
};

export const exportAiQuotaToExcel = async (users, t = (s) => s, fileName = '') => {
  const sheetData = buildAiQuotaExcelData(users, t);
  const targetName = fileName || `ai_quota_usage_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const blob = await writeExcelFile(sheetData, {
    columns: AI_QUOTA_EXCEL_COLUMNS,
    stickyRowsCount: 1
  }).toBlob();
  downloadExcelBlob(blob, targetName);
  return blob;
};

// ==========================================
// 3. USER ANALYTICS REPORT EXPORT (.xlsx)
// ==========================================

export const USER_ANALYTICS_EXCEL_COLUMNS = [
  { width: 8 },  // STT
  { width: 12 }, // User ID
  { width: 26 }, // Họ tên
  { width: 20 }, // Tên đăng nhập
  { width: 32 }, // Email
  { width: 20 }, // Trạng thái
  { width: 22 }, // Tiến độ khóa học (%)
  { width: 20 }, // Bài học hoàn thành
  { width: 22 }, // Thời gian học (phút)
  { width: 22 }, // Điểm Quiz trung bình
  { width: 20 }, // Token AI đã dùng
  { width: 22 }  // Hoạt động gần nhất
];

export const buildUserAnalyticsExcelData = (learners, statusMeta = {}, t = (s) => s) => {
  const headers = [
    t('STT'),
    t('User ID'),
    t('Họ tên'),
    t('Tên đăng nhập'),
    'Email',
    t('Trạng thái'),
    t('Tiến độ khóa học (%)'),
    t('Bài học hoàn thành'),
    t('Thời gian học (phút)'),
    t('Điểm Quiz TB'),
    t('Token AI đã dùng'),
    t('Hoạt động gần nhất')
  ].map((title) => ({ value: title, ...EXCEL_HEADER_STYLE }));

  const rows = learners.map((l, index) => {
    const rowBg = index % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
    const rowBase = { ...EXCEL_BASE_CELL, backgroundColor: rowBg };

    const statusKey = l.engagement_status || 'active';
    const statusLabel = statusMeta[statusKey]?.label || statusKey;
    const statusStyle = getLearnerStatusStyle(statusKey);

    const progressVal = Number(l.progress_percent) || 0;
    const avgScore = Number(l.average_quiz_score) || 0;

    return [
      { value: index + 1, type: Number, ...rowBase, align: 'center' },
      { value: Number(l.user_id) || l.user_id, type: Number, ...rowBase, align: 'center' },
      { value: String(l.full_name || ''), ...rowBase, align: 'left', fontWeight: 'bold' },
      { value: String(l.username || ''), ...rowBase, align: 'left' },
      { value: String(l.email || ''), ...rowBase, align: 'left' },
      { value: statusLabel, ...EXCEL_BASE_CELL, ...statusStyle, align: 'center', fontWeight: 'bold' },
      { value: Number((progressVal / 100).toFixed(4)), type: Number, format: '0%', ...rowBase, align: 'right' },
      { value: Number(l.completed_lessons) || 0, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      { value: Number(l.study_minutes) || 0, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      { value: avgScore, type: Number, format: '0.0', ...rowBase, align: 'right' },
      { value: Number(l.used_tokens) || 0, type: Number, format: '#,##0', ...rowBase, align: 'right' },
      { value: formatReadableDate(l.last_activity_at), ...rowBase, align: 'center' }
    ];
  });

  return [headers, ...rows];
};

export const exportUserAnalyticsToExcel = async (learners, range = 30, statusMeta = {}, t = (s) => s, fileName = '') => {
  const sheetData = buildUserAnalyticsExcelData(learners, statusMeta, t);
  const targetName = fileName || `elearn_user_analytics_${range}d_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const blob = await writeExcelFile(sheetData, {
    columns: USER_ANALYTICS_EXCEL_COLUMNS,
    stickyRowsCount: 1
  }).toBlob();
  downloadExcelBlob(blob, targetName);
  return blob;
};
