const REQUIRED_PRODUCTION_AI_VARIABLES = [
  'GEMINI_API_KEY',
  'PINECONE_API_KEY'
];

function getMissingProductionAiVariables(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  return REQUIRED_PRODUCTION_AI_VARIABLES.filter(name => {
    const value = env[name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

function assertProductionAiEnvironment(env = process.env) {
  const missing = getMissingProductionAiVariables(env);
  if (missing.length === 0) return;

  throw new Error(
    `Thiếu biến môi trường AI bắt buộc trong production: ${missing.join(', ')}. `
    + 'Hãy cấu hình secrets trên nền tảng đang chạy backend trước khi deploy.'
  );
}

module.exports = {
  REQUIRED_PRODUCTION_AI_VARIABLES,
  getMissingProductionAiVariables,
  assertProductionAiEnvironment
};
