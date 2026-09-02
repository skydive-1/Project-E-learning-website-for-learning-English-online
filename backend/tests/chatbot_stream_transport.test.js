'use strict';

const { EventEmitter } = require('node:events');
const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const chatbotService = require('../src/modules/chatbot/services/chatbot.service');
const chatbotController = require('../src/modules/chatbot/controllers/chatbot.controller');

const originalAskStream = chatbotService.askStream;

const createRequest = () => {
  const req = new EventEmitter();
  req.body = {
    question: 'Học gì hôm nay?',
    lessonId: 0,
    scope: 'lesson'
  };
  req.user = { id: 7, roleId: 1 };
  req.aborted = false;
  return req;
};

const createResponse = () => {
  const res = new EventEmitter();
  res.headers = new Map();
  res.headersSent = false;
  res.destroyed = false;
  res.writableEnded = false;
  res.writes = [];
  res.endCalls = 0;
  res.setHeader = (name, value) => res.headers.set(name.toLowerCase(), value);
  res.flushHeaders = () => { res.headersSent = true; };
  res.write = (payload) => {
    res.headersSent = true;
    res.writes.push(payload);
    return true;
  };
  res.end = () => {
    res.endCalls += 1;
    res.writableEnded = true;
  };
  return res;
};

afterEach(() => {
  chatbotService.askStream = originalAskStream;
});

describe('Chatbot SSE transport', () => {
  test('opens an HTTP/2-safe stream, sends heartbeat, token, and DONE', async () => {
    const req = createRequest();
    const res = createResponse();
    let nextError = null;
    let heartbeatCallback = null;
    let heartbeatDelay = null;
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    global.setInterval = (callback, delay) => {
      heartbeatCallback = callback;
      heartbeatDelay = delay;
      return { unref() {} };
    };
    global.clearInterval = () => {};

    chatbotService.askStream = async (_question, _lessonId, _userId, onChunk) => {
      heartbeatCallback();
      onChunk({ type: 'token', text: 'Hello' });
    };

    try {
      await chatbotController.askStream(req, res, (error) => { nextError = error; });
    } finally {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }

    assert.equal(nextError, null);
    assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-cache, no-transform');
    assert.equal(res.headers.get('x-accel-buffering'), 'no');
    assert.equal(res.headers.has('connection'), false);
    assert.equal(heartbeatDelay, 15_000);
    assert.deepEqual(res.writes, [
      ': connected\n\n',
      ': heartbeat\n\n',
      'data: {"type":"token","text":"Hello"}\n\n',
      'data: [DONE]\n\n'
    ]);
    assert.equal(res.endCalls, 1);
  });

  test('returns a structured SSE error when AI fails after headers were sent', async () => {
    const req = createRequest();
    const res = createResponse();
    let nextError = null;
    const aiError = new Error('Gemini unavailable');
    aiError.code = 'GEMINI_UNAVAILABLE';
    chatbotService.askStream = async () => { throw aiError; };

    await chatbotController.askStream(req, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.endCalls, 1);
    assert.equal(res.writes[0], ': connected\n\n');
    assert.match(res.writes[1], /"type":"error"/);
    assert.match(res.writes[1], /"code":"GEMINI_UNAVAILABLE"/);
    assert.match(res.writes[1], /"error":"Gemini unavailable"/);
    assert.equal(res.writes.some((payload) => payload.includes('[DONE]')), false);
  });

  test('does not write or end after the client aborts the request', async () => {
    const req = createRequest();
    const res = createResponse();
    let nextError = null;

    chatbotService.askStream = async (_question, _lessonId, _userId, onChunk) => {
      req.aborted = true;
      req.emit('aborted');
      onChunk({ type: 'token', text: 'must not be written' });
    };

    await chatbotController.askStream(req, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.deepEqual(res.writes, [': connected\n\n']);
    assert.equal(res.endCalls, 0);
  });
});
