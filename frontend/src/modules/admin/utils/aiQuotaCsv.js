const neutralizeSpreadsheetFormula = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

export const escapeCsvField = (value) => {
  const safe = neutralizeSpreadsheetFormula(value).replace(/"/g, '""');
  return `"${safe}"`;
};

const toIsoDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export const buildAiQuotaCsv = (users, t = (value) => value) => {
  const headers = [
    'STT',
    t('ID người dùng'),
    t('Họ tên'),
    t('Tên đăng nhập'),
    'Email',
    t('Vai trò'),
    t('Token đã dùng'),
    t('Hạn mức tối đa'),
    t('Phần trăm đã dùng'),
    t('Lượt hỏi hôm nay'),
    t('Hạn mức câu hỏi trong ngày'),
    t('Số câu hỏi còn lại'),
    t('Thời điểm đặt lại'),
    t('Trạng thái'),
    t('Tương tác gần nhất')
  ];

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
    const tokenLimit = Number(user.max_tokens || 6000);
    const usedTokens = Number(user.used_tokens || 0);
    const tokenPercentage = Number(user.usage_percentage ?? Math.min(100, Math.round((usedTokens / tokenLimit) * 100)));
    const role = isAdmin
      ? t('Quản trị viên hệ thống')
      : Number(user.role_id) === 2 ? t('Giảng viên hệ thống') : t('Học viên hệ thống');

    return [
      index + 1,
      user.user_id,
      user.full_name || '',
      user.username || '',
      user.email || '',
      role,
      usedTokens,
      tokenLimit,
      tokenPercentage,
      isUnlimited ? t('Không giới hạn') : usedQuestions,
      isUnlimited ? t('Không giới hạn') : questionLimit,
      isUnlimited ? t('Không giới hạn') : remainingQuestions,
      toIsoDate(user.question_reset_at),
      statusLabels[user.question_quota_status] || user.question_quota_status || '',
      toIsoDate(user.last_ai_activity_at)
    ];
  });

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n')}`;
};

export const downloadCsvReport = (csvContent, fileName) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const objectUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null;
  link.href = objectUrl || `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
};
