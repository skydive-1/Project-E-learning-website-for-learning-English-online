'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTranscriptText,
  getFallbackSuggestedQuestions,
  isLegacyGenericQuestionSet,
  normalizeSuggestedQuestions
} = require('../src/modules/lessons/services/suggestedQuestions.service');

test('suggested questions reject generic, ungrounded and oversized content', () => {
  const transcript = 'Today we practise small talk, greetings, and the phrase nice to meet you.';
  const result = normalizeSuggestedQuestions([
    '“small talk” được dùng khi nào?',
    'Mục đích và nội dung chính của bài này là gì?',
    'Câu hỏi về present perfect?',
    'A'.repeat(120),
    '“nice to meet you” có nghĩa gì?',
    'Bài luyện “greetings” như thế nào?',
    'Cho ví dụ về “small talk”?'
  ], transcript);

  assert.deepEqual(result, [
    '“small talk” được dùng khi nào?',
    '“nice to meet you” có nghĩa gì?',
    'Bài luyện “greetings” như thế nào?',
    'Cho ví dụ về “small talk”?'
  ]);
  assert.equal(result.every(question => question.length <= 92), true);
});

test('grounded fallback only uses terms found in the transcript', () => {
  const transcript = buildTranscriptText([
    { en: 'We use greetings before starting small talk.' },
    { en: 'Small talk helps begin everyday conversations.' }
  ]);
  const questions = getFallbackSuggestedQuestions('Everyday conversations', '', transcript);

  assert.equal(questions.length, 4);
  assert.equal(questions.every(question => question.length <= 92), true);
  assert.equal(
    questions.every((question) => {
      const groundedTerm = question.match(/“([^”]+)”/)?.[1];
      return groundedTerm && transcript.toLowerCase().includes(groundedTerm.toLowerCase());
    }),
    true
  );
});

test('legacy template sets are detected for automatic regeneration', () => {
  assert.equal(isLegacyGenericQuestionSet([
    'Mục đích và nội dung chính của bài "Welcome" là gì?',
    'Một câu khác?'
  ]), true);
  assert.equal(isLegacyGenericQuestionSet([
    '“small talk” được dùng khi nào?',
    '“greetings” xuất hiện ở đâu?'
  ]), false);
});
