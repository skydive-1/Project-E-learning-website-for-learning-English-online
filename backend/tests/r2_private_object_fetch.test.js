'use strict';

const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { afterEach, beforeEach, describe, it } = require('node:test');

const r2Storage = require('../src/utils/r2Storage');

describe('R2 private object reads', () => {
  const originalEnv = {};

  beforeEach(() => {
    for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
      originalEnv[name] = process.env[name];
    }
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET = 'test-bucket';
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('uses GetObject with the requested byte range instead of a signed-url fetch hop', async () => {
    const calls = [];
    const abortController = new AbortController();
    const client = {
      send: async (command, options) => {
        calls.push({ input: command.input, options });
        return {
          AcceptRanges: 'bytes',
          Body: Readable.from([Buffer.from([1, 2, 3, 4])]),
          ContentLength: 4,
          ContentRange: 'bytes 4-7/20',
          ContentType: 'video/mp4'
        };
      }
    };

    const response = await r2Storage.fetchPrivateObject(
      'courses/41/lesson/audio.mp4',
      'videos',
      'bytes=4-7',
      'r2',
      { signal: abortController.signal, client }
    );

    assert.deepEqual(calls[0].input, {
      Bucket: 'test-bucket',
      Key: 'courses/41/lesson/audio.mp4',
      Range: 'bytes=4-7'
    });
    assert.strictEqual(calls[0].options.abortSignal, abortController.signal);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 4-7/20');
    assert.equal(response.headers.get('content-length'), '4');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([1, 2, 3, 4]));
  });

  it('normalizes an R2 missing-object response without exposing storage errors', async () => {
    const client = {
      send: async () => {
        const error = new Error('NoSuchKey');
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }
    };

    const response = await r2Storage.fetchPrivateObject(
      'courses/41/lesson/missing.mp4',
      'videos',
      'bytes=0-3',
      'r2',
      { client }
    );

    assert.equal(response.status, 404);
  });
});
