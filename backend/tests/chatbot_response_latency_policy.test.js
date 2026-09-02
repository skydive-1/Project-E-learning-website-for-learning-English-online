'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isCourseCatalogQuestion,
  isComplexGlobalQuestion,
  selectGlobalChatProfile,
  buildCourseCatalogReply
} = require('../src/modules/chatbot/services/globalCourseResponse.service');
const { normalizeRequest } = require('../src/utils/ai-clients');

test('detects Vietnamese and English course catalog questions without hijacking general English QA', () => {
  assert.equal(isCourseCatalogQuestion('Cho tôi tóm tắt về các khóa học tiếng Anh hiện có trên website.'), true);
  assert.equal(isCourseCatalogQuestion('What courses are currently available?'), true);
  assert.equal(isCourseCatalogQuestion('Giải thích thì hiện tại hoàn thành trong tiếng Anh.'), false);
  assert.equal(isCourseCatalogQuestion('Course nghĩa là gì?'), false);
});

test('builds a deterministic grounded response from database course rows', () => {
  const reply = buildCourseCatalogReply([
    { course_name: 'IELTS Masterclass', description: 'Luyện bốn kỹ năng IELTS.' },
    { course_name: 'TOEIC', description: null }
  ]);

  assert.match(reply, /2 khóa học tiếng Anh/);
  assert.match(reply, /IELTS Masterclass: Luyện bốn kỹ năng IELTS/);
  assert.match(reply, /TOEIC: Hiện chưa có mô tả chi tiết/);
});

test('returns explicit empty and database-failure states', () => {
  assert.match(buildCourseCatalogReply([]), /chưa có khóa học nào/i);
  assert.match(buildCourseCatalogReply([], { loadFailed: true }), /chưa thể tải danh sách khóa học/i);
});

test('routes simple global questions to Flash-Lite and deep requests to Gemini 3.7 Flash', () => {
  assert.equal(isComplexGlobalQuestion('What is the difference between say and tell?'), false);
  assert.equal(isComplexGlobalQuestion('Essay nghĩa là gì?'), false);
  assert.deepEqual(selectGlobalChatProfile('What is the difference between say and tell?'), {
    tier: 'fast',
    model: 'gemini-3.5-flash-lite',
    maxOutputTokens: 768,
    thinkingLevel: 'MINIMAL'
  });

  assert.equal(isComplexGlobalQuestion('Hãy phân tích chi tiết bài luận IELTS Writing này và lập kế hoạch cải thiện.'), true);
  assert.deepEqual(selectGlobalChatProfile('Hãy phân tích chi tiết bài luận IELTS Writing này và lập kế hoạch cải thiện.'), {
    tier: 'deep',
    model: 'gemini-3.7-flash',
    maxOutputTokens: 2048,
    thinkingLevel: 'LOW'
  });
});

test('AI request normalization preserves fast-model and minimal-thinking latency controls', () => {
  const normalized = normalizeRequest({
    model: 'gemini-3.5-flash-lite',
    contents: 'Short global chat prompt',
    generationConfig: {
      maxOutputTokens: 768,
      thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: false }
    }
  });

  assert.equal(normalized.model, 'gemini-3.5-flash-lite');
  assert.equal(normalized.config.maxOutputTokens, 768);
  assert.deepEqual(normalized.config.thinkingConfig, {
    thinkingLevel: 'MINIMAL',
    includeThoughts: false
  });
});

test('sync and streaming catalog routes bypass Gemini generation', () => {
  const servicePath = path.join(
    __dirname,
    '..',
    'src',
    'modules',
    'chatbot',
    'services',
    'chatbot.service.js'
  );
  const source = fs.readFileSync(servicePath, 'utf8');
  const routePattern = 'if (isCourseCatalogQuestion(question))';
  const firstRoute = source.indexOf(routePattern);
  const secondRoute = source.indexOf(routePattern, firstRoute + routePattern.length);
  const syncGeneration = source.indexOf('geminiModel.generateContent(generationRequest)');
  const streamGeneration = source.indexOf('geminiModel.generateContentStream(generationRequest)');

  assert.ok(firstRoute >= 0 && firstRoute < syncGeneration);
  assert.ok(secondRoute > firstRoute && secondRoute < streamGeneration);
});
