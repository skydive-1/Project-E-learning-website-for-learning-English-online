'use strict';

const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const express = require('express');
const securityHeaders = require('../src/middleware/securityHeaders.middleware');

describe('Security Headers Middleware (Launch Checklist)', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    app = express();
    app.disable('x-powered-by');
    app.use(securityHeaders);
    app.get('/test', (req, res) => {
      res.json({ ok: true });
    });

    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('sets X-Content-Type-Options: nosniff to prevent MIME sniffing', async () => {
    const res = await fetch(`${baseUrl}/test`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  it('sets X-Frame-Options: SAMEORIGIN to prevent Clickjacking', async () => {
    const res = await fetch(`${baseUrl}/test`);
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  });

  it('sets X-XSS-Protection: 0 per modern OWASP standard', async () => {
    const res = await fetch(`${baseUrl}/test`);
    assert.equal(res.headers.get('x-xss-protection'), '0');
  });

  it('sets Referrer-Policy: strict-origin-when-cross-origin', async () => {
    const res = await fetch(`${baseUrl}/test`);
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  it('sets Cross-Origin-Resource-Policy: cross-origin for client media asset loading', async () => {
    const res = await fetch(`${baseUrl}/test`);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  it('hides X-Powered-By header so server signature is not disclosed', async () => {
    const res = await fetch(`${baseUrl}/test`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  it('sets Strict-Transport-Security (HSTS) when request is HTTPS or forwarded as HTTPS', async () => {
    const res = await fetch(`${baseUrl}/test`, {
      headers: {
        'x-forwarded-proto': 'https'
      }
    });
    const hsts = res.headers.get('strict-transport-security');
    assert.ok(hsts, 'HSTS header should be present on HTTPS/forwarded HTTPS request');
    assert.ok(hsts.includes('max-age=31536000'), 'HSTS should enforce max-age=31536000');
    assert.ok(hsts.includes('includeSubDomains'), 'HSTS should enforce includeSubDomains');
  });
});
