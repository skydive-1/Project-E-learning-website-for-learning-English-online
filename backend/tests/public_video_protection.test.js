const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');

const { authenticatePublicVideoToken } = require('../src/middleware/auth.middleware');
const mediaController = require('../src/modules/media/media.controller');
const { blockDirectVideoAccess } = require('../src/modules/media/directVideoAccess.middleware');
const {
  PUBLIC_VIDEO_ASSETS,
  PUBLIC_VIDEO_ROOT
} = require('../src/modules/media/publicVideoAssets');

describe('Protected video coverage', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  let server;
  let baseUrl;

  before(async () => {
    process.env.JWT_SECRET = 'public-video-test-secret-at-least-32-characters';
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    const app = express();
    app.get('/api/media/video/ticket', mediaController.getPublicVideoTicket);
    app.get(
      '/api/media/video/stream/:assetId',
      authenticatePublicVideoToken,
      mediaController.streamPublicVideo
    );
    app.use('/uploads', blockDirectVideoAccess, express.static(path.join(__dirname, '../uploads')));

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.FRONTEND_URL = originalFrontendUrl;
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('every bundled website MP4 is outside frontend/public and registered', () => {
    const registeredFiles = new Set(Object.values(PUBLIC_VIDEO_ASSETS));
    const protectedFiles = fs.readdirSync(PUBLIC_VIDEO_ROOT).filter((name) => name.endsWith('.mp4'));
    assert.deepStrictEqual(new Set(protectedFiles), registeredFiles);

    const oldPublicDirectory = path.join(__dirname, '../../frontend/public/videos');
    const publicVideos = fs.existsSync(oldPublicDirectory)
      ? fs.readdirSync(oldPublicDirectory).filter((name) => /\.(mp4|webm|mov|mkv|avi)$/i.test(name))
      : [];
    assert.deepStrictEqual(publicVideos, []);
  });

  test('public interface stream requires its HttpOnly ticket and returns bounded ranges', async () => {
    const commonHeaders = {
      Referer: 'http://localhost:3000/',
      'User-Agent': 'ProtectedVideoTestBrowser/1.0'
    };

    const denied = await fetch(`${baseUrl}/api/media/video/stream/girl-typing`, {
      headers: { ...commonHeaders, Range: 'bytes=0-1023' }
    });
    assert.strictEqual(denied.status, 401);

    const ticketResponse = await fetch(`${baseUrl}/api/media/video/ticket`, { headers: commonHeaders });
    const ticketBody = await ticketResponse.json();
    const cookie = (ticketResponse.headers.get('set-cookie') || '').split(';')[0];
    assert.strictEqual(ticketResponse.status, 200);
    assert.strictEqual(ticketBody.success, true);
    assert.strictEqual(Object.hasOwn(ticketBody, 'ticket'), false);
    assert.match(ticketResponse.headers.get('set-cookie') || '', /public_video_playback_ticket=.*HttpOnly/i);

    const streamResponse = await fetch(`${baseUrl}/api/media/video/stream/girl-typing`, {
      headers: { ...commonHeaders, Cookie: cookie, Range: 'bytes=0-1023' }
    });
    assert.strictEqual(streamResponse.status, 206);
    assert.strictEqual(streamResponse.headers.get('content-type'), 'video/mp4');
    assert.strictEqual(streamResponse.headers.get('cache-control')?.includes('no-store'), true);
    assert.strictEqual((await streamResponse.arrayBuffer()).byteLength, 1024);
  });

  test('IDM user agents and direct upload video URLs are blocked', async () => {
    const idmResponse = await fetch(`${baseUrl}/api/media/video/ticket`, {
      headers: {
        Referer: 'http://localhost:3000/',
        'User-Agent': 'Internet Download Manager/6.42'
      }
    });
    assert.strictEqual(idmResponse.status, 403);
    assert.strictEqual((await idmResponse.json()).code, 'DOWNLOAD_MANAGER_BLOCKED');

    const directResponse = await fetch(`${baseUrl}/uploads/videos/valid_test_video.mp4`);
    assert.strictEqual(directResponse.status, 403);
    assert.strictEqual((await directResponse.json()).code, 'DIRECT_VIDEO_ACCESS_BLOCKED');
  });
});
