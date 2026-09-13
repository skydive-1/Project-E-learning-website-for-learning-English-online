const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { isAllowedFrontendOrigin } = require('../src/utils/videoSecurity.util');

describe('CORS production origin allowlist', () => {
  const productionEnv = {
    NODE_ENV: 'production',
    FRONTEND_URL: [
      'https://project-e-learning-website-for-learning-english.vercel.app',
      'https://project-e-learning-preview.vercel.app'
    ].join(',')
  };

  test('allows every explicitly configured production and preview origin', () => {
    assert.strictEqual(
      isAllowedFrontendOrigin(
        'https://project-e-learning-website-for-learning-english.vercel.app',
        productionEnv
      ),
      true
    );
    assert.strictEqual(
      isAllowedFrontendOrigin('https://project-e-learning-preview.vercel.app/course/42', productionEnv),
      true
    );
  });

  test('rejects an unconfigured Vercel domain even when its name looks similar', () => {
    assert.strictEqual(
      isAllowedFrontendOrigin('https://project-e-learning-website-attacker.vercel.app', productionEnv),
      false
    );
  });

  test('keeps localhost convenience limited to non-production environments', () => {
    assert.strictEqual(
      isAllowedFrontendOrigin('http://localhost:5173', { NODE_ENV: 'development', FRONTEND_URL: '' }),
      true
    );
    assert.strictEqual(
      isAllowedFrontendOrigin('http://localhost:5173', productionEnv),
      false
    );
  });
});
