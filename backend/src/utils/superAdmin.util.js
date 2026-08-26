const DEFAULT_SUPER_ADMIN_EMAILS = Object.freeze([
  'quocanh26012004@gmail.com'
]);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getSuperAdminEmails = () => {
  // Hỗ trợ cả tên biến cũ dạng số ít để deployment hiện tại không mất quyền.
  const configuredValue = process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || '';
  const configured = String(configuredValue)
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_SUPER_ADMIN_EMAILS);
};

const hasAdminRole = (user) => {
  const roleId = Number(user?.roleId ?? user?.role_id);
  return roleId === 1 || user?.role === 'admin';
};

const isSuperAdminEmail = (email) => getSuperAdminEmails().has(normalizeEmail(email));

// Email nằm trong allowlist là chưa đủ: tài khoản vẫn bắt buộc phải có role Admin
// mới nhận được đặc quyền Super Admin.
const isSuperAdminUser = (user) => hasAdminRole(user) && isSuperAdminEmail(user?.email);

module.exports = {
  DEFAULT_SUPER_ADMIN_EMAILS,
  getSuperAdminEmails,
  hasAdminRole,
  isSuperAdminEmail,
  isSuperAdminUser,
  normalizeEmail
};
