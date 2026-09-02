'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  requiresSourceGrounding,
  hasUsableGrounding,
  getInsufficientGroundingReply,
  getPromptGroundingRules
} = require('../src/modules/chatbot/services/groundingPolicy.service');

test('lesson and course retrieval intents require source grounding', () => {
  assert.equal(requiresSourceGrounding({
    detectedIntent: { intent: 'CURRENT_LESSON_QA', scope: 'current_lesson' }
  }), true);
  assert.equal(requiresSourceGrounding({
    detectedIntent: { intent: 'SEARCH_LESSON', scope: 'course_wide' }
  }), true);
});

test('general English and global chat remain separate from lesson grounding', () => {
  assert.equal(requiresSourceGrounding({
    detectedIntent: { intent: 'GENERAL_ENGLISH_QA', scope: 'none' }
  }), false);
  assert.equal(requiresSourceGrounding({
    isGlobalChat: true,
    detectedIntent: { intent: 'COURSE_QA', scope: 'course_wide' }
  }), false);
});

test('grounded generation requires both verified context and a verified source', () => {
  const source = [{ lessonId: 14, lessonTitle: 'Present Continuous' }];
  assert.equal(hasUsableGrounding('Verified transcript content', source), true);
  assert.equal(hasUsableGrounding('', source), false);
  assert.equal(hasUsableGrounding('Unverified free text', []), false);
});

test('grounding policy refuses missing evidence and forbids outside knowledge', () => {
  assert.match(getInsufficientGroundingReply('CURRENT_LESSON_QA'), /chưa tìm thấy nội dung đủ tin cậy/i);
  const rules = getPromptGroundingRules(true);
  assert.match(rules, /Chỉ được dùng thông tin có trong NGỮ CẢNH ĐÃ XÁC MINH/i);
  assert.match(rules, /Không bổ sung kiến thức bên ngoài/i);
});

test('sync and streaming request paths apply the grounding gate before Gemini generation', () => {
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
  const gatePattern = 'if (groundingRequired && !hasUsableGrounding(contextText, verifiedEvidence.sources))';
  const firstGate = source.indexOf(gatePattern);
  const secondGate = source.indexOf(gatePattern, firstGate + gatePattern.length);
  const syncGeneration = source.indexOf('geminiModel.generateContent(systemPrompt)');
  const streamGeneration = source.indexOf('geminiModel.generateContentStream(systemPrompt)');

  assert.ok(firstGate >= 0 && firstGate < syncGeneration);
  assert.ok(secondGate > firstGate && secondGate < streamGeneration);
  assert.match(source, /const verifiedEvidence = await buildVerifiedEvidence/);
  assert.match(source, /getPromptGroundingRules\(groundingRequired\)/);
});
