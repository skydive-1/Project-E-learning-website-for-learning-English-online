const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const authController = require('../src/modules/auth/controllers/auth.controller');

describe('Auth Token Exchange Endpoint', () => {
  it('returns success and acknowledges recovery token exchange', async () => {
    let responseStatus;
    let responseBody;

    const req = {
      body: {
        type: 'recovery',
        access_token: 'fake-jwt-recovery-token-12345'
      }
    };

    const res = {
      status: (code) => {
        responseStatus = code;
        return res;
      },
      json: (data) => {
        responseBody = data;
        return res;
      }
    };

    const next = (err) => {
      if (err) throw err;
    };

    await authController.exchangeToken(req, res, next);

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseBody.success, true);
    assert.strictEqual(responseBody.type, 'recovery');
  });

  it('handles empty or non-recovery exchange requests cleanly', async () => {
    let responseStatus;
    let responseBody;

    const req = {
      body: {}
    };

    const res = {
      status: (code) => {
        responseStatus = code;
        return res;
      },
      json: (data) => {
        responseBody = data;
        return res;
      }
    };

    await authController.exchangeToken(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseBody.success, true);
  });
});
