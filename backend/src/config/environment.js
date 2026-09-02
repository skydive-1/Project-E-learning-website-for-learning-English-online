const REQUIRED_PRODUCTION_VARIABLES = [
  'JWT_SECRET',
  'FRONTEND_URL',
  'GEMINI_API_KEY',
  'PINECONE_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'ENABLE_DRM_PACKAGING',
  'ENABLE_SUBTITLE_VAD'
];

function getMissingProductionVariables(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  const missing = REQUIRED_PRODUCTION_VARIABLES.filter(name => {
    const value = env[name];
    return typeof value !== 'string' || value.trim() === '';
  });

  const hasDatabaseUrl = typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.trim() !== '';
  if (!hasDatabaseUrl) {
    for (const name of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
      const value = env[name];
      if (typeof value !== 'string' || value.trim() === '') missing.push(name);
    }
  }

  for (const name of ['ENABLE_DRM_PACKAGING', 'ENABLE_SUBTITLE_VAD']) {
    const value = String(env[name] || '').trim().toLowerCase();
    if (value && value !== 'true' && !missing.includes(`${name}=true`)) {
      missing.push(`${name}=true`);
    }
  }

  return missing;
}

function assertProductionEnvironment(env = process.env) {
  const missing = getMissingProductionVariables(env);
  if (missing.length === 0) return;

  throw new Error(
    `Thiếu biến môi trường bắt buộc trong production: ${missing.join(', ')}. `
    + 'Hãy cấu hình secrets trên nền tảng đang chạy backend trước khi deploy.'
  );
}

// Tương thích với các script và test dùng tên export cũ.
const getMissingProductionAiVariables = getMissingProductionVariables;
const assertProductionAiEnvironment = assertProductionEnvironment;

module.exports = {
  REQUIRED_PRODUCTION_VARIABLES,
  REQUIRED_PRODUCTION_AI_VARIABLES: REQUIRED_PRODUCTION_VARIABLES,
  getMissingProductionVariables,
  assertProductionEnvironment,
  getMissingProductionAiVariables,
  assertProductionAiEnvironment
};
