const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  getMissingProductionAiVariables,
  assertProductionAiEnvironment
} = require('../src/config/environment');

describe('Production AI environment validation', () => {
  test('development may load secrets from backend/.env through Docker Compose', () => {
    assert.deepEqual(getMissingProductionAiVariables({ NODE_ENV: 'development' }), []);
  });

  test('production requires both Gemini and Pinecone secrets', () => {
    assert.deepEqual(
      getMissingProductionAiVariables({ NODE_ENV: 'production', GEMINI_API_KEY: 'gemini-key' }),
      ['PINECONE_API_KEY']
    );

    assert.throws(
      () => assertProductionAiEnvironment({ NODE_ENV: 'production', PINECONE_API_KEY: 'pinecone-key' }),
      /GEMINI_API_KEY/
    );
  });

  test('production accepts secrets injected by the backend hosting platform', () => {
    assert.doesNotThrow(() => assertProductionAiEnvironment({
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'gemini-key',
      PINECONE_API_KEY: 'pinecone-key'
    }));
  });
});
