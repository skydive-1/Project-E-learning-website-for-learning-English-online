const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

describe('CORS and Vercel Deployment Origin Support', () => {
  const vercelPattern = /^https:\/\/.*project-e-learning-website.*\.vercel\.app$/i;

  test('should allow user deployed Vercel domain', () => {
    const userDomain = 'https://project-e-learning-website-for-lear-iota.vercel.app';
    assert.strictEqual(vercelPattern.test(userDomain), true);
  });

  test('should allow standard vercel project domain', () => {
    const prodDomain = 'https://project-e-learning-website-for-learning-english.vercel.app';
    assert.strictEqual(vercelPattern.test(prodDomain), true);
  });

  test('should reject malicious third-party domain', () => {
    const evilDomain = 'https://malicious-site.vercel.app';
    assert.strictEqual(vercelPattern.test(evilDomain), false);
  });
});
