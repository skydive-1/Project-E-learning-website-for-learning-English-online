const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  getMissingProductionAiVariables,
  assertProductionAiEnvironment
} = require('../src/config/environment');

const validProductionEnvironment = {
  NODE_ENV: 'production',
  JWT_SECRET: 'strong-test-secret',
  FRONTEND_URL: 'https://example.test',
  GEMINI_API_KEY: 'gemini-key',
  PINECONE_API_KEY: 'pinecone-key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SMTP_HOST: 'smtp.example.test',
  SMTP_USER: 'mailer@example.test',
  SMTP_PASS: 'smtp-secret',
  ENABLE_DRM_PACKAGING: 'true',
  ENABLE_SUBTITLE_VAD: 'true',
  DATABASE_URL: 'postgresql://example.invalid/database'
};

describe('Production environment validation', () => {
  test('development may load secrets from backend/.env through Docker Compose', () => {
    assert.deepEqual(getMissingProductionAiVariables({ NODE_ENV: 'development' }), []);
  });

  test('production reports all missing infrastructure variables', () => {
    const missing = getMissingProductionAiVariables({ NODE_ENV: 'production' });
    for (const requiredName of [
      'JWT_SECRET', 'FRONTEND_URL', 'GEMINI_API_KEY', 'PINECONE_API_KEY',
      'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SMTP_HOST', 'SMTP_USER',
      'SMTP_PASS', 'ENABLE_DRM_PACKAGING', 'ENABLE_SUBTITLE_VAD',
      'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'
    ]) {
      assert.ok(missing.includes(requiredName), `${requiredName} must be reported missing`);
    }
    assert.throws(
      () => assertProductionAiEnvironment({ NODE_ENV: 'production' }),
      /Thiếu biến môi trường bắt buộc/
    );
  });

  test('production accepts a complete environment using DATABASE_URL', () => {
    assert.doesNotThrow(() => assertProductionAiEnvironment(validProductionEnvironment));
    assert.deepEqual(getMissingProductionAiVariables(validProductionEnvironment), []);
  });

  test('production accepts discrete database connection variables', () => {
    const env = {
      ...validProductionEnvironment,
      DATABASE_URL: '',
      DB_HOST: 'database.internal',
      DB_NAME: 'elearning',
      DB_USER: 'app',
      DB_PASSWORD: 'secret'
    };
    assert.deepEqual(getMissingProductionAiVariables(env), []);
  });

  test('production rejects explicitly disabled DRM or VAD pipelines', () => {
    const missing = getMissingProductionAiVariables({
      ...validProductionEnvironment,
      ENABLE_DRM_PACKAGING: 'false',
      ENABLE_SUBTITLE_VAD: 'false'
    });
    assert.ok(missing.includes('ENABLE_DRM_PACKAGING=true'));
    assert.ok(missing.includes('ENABLE_SUBTITLE_VAD=true'));
  });
});
