'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTranscriptText,
  getFallbackSuggestedQuestions,
  getSuggestedQuestionsByLessonId,
  isLegacyGenericQuestionSet,
  normalizeSuggestedQuestions,
  normalizeSuggestedItems
} = require('../src/modules/lessons/services/suggestedQuestions.service');
const db = require('../src/config/database');
const { geminiModel } = require('../src/utils/ai-clients');

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
    'Bài này có những ý chính nào?',
    'Khái niệm nào cần ghi nhớ?',
    'Từ nào xuất hiện trong bài?',
    'Kiểm tra nhanh kiến thức bài này?'
  ]), true);
  assert.equal(isLegacyGenericQuestionSet([
    '“small talk” được dùng khi nào?',
    '“greetings” xuất hiện ở đâu?'
  ]), false);
});

test('fallback without transcript returns no fabricated suggestions', () => {
  const questions = getFallbackSuggestedQuestions('Nguyên âm đôi /e/ và /ai/', 'Basic Pronunciation');
  assert.deepEqual(questions, []);
  assert.deepEqual(normalizeSuggestedQuestions(['Present perfect dùng khi nào?'], ''), []);
});

test('AI suggested question evidence must be a real transcript substring', () => {
  const transcript = 'Today we practise small talk before meeting a new colleague.';
  const items = normalizeSuggestedItems([
    { question: 'Small talk được dùng trong tình huống nào?', evidence: 'we practise small talk' },
    { question: 'Present perfect được giải thích ra sao?', evidence: 'Present perfect is taught here' },
    { question: 'Câu hỏi thiếu bằng chứng?', evidence: '' }
  ], transcript);

  assert.deepEqual(items, [{
    question: 'Small talk được dùng trong tình huống nào?',
    evidence: 'we practise small talk'
  }]);
});

test('cold suggested-question requests return grounded prompts without waiting for Gemini', async () => {
  const originalQuery = db.query;
  const originalGenerateContent = geminiModel.generateContent;
  const transcript = [
    { en: 'We practise small talk with friendly greetings before meeting a new colleague.' },
    { en: 'Small talk helps everyday conversations feel natural.' },
    { en: 'We say nice to meet you when meeting a colleague.' }
  ];
  let resolveAi;
  let aiStarted = false;
  let savedCount = 0;

  db.query = async (sql) => {
    if (sql.includes('LEFT JOIN lesson_subtitles')) {
      return {
        rows: [{
          lesson_title: 'Everyday English',
          section_title: 'Greetings',
          course_name: 'English Basics',
          content_type: 'video',
          content_url: '/uploads/lesson.mp4',
          cues: transcript,
          subtitle_status: 'ready',
          questions: null
        }]
      };
    }
    if (sql.includes('SELECT l.title AS lesson_title')) {
      return { rows: [{ lesson_title: 'Everyday English', section_title: 'Greetings', course_name: 'English Basics' }] };
    }
    if (sql.includes('INSERT INTO lesson_suggested_questions')) {
      savedCount += 1;
      return { rows: [] };
    }
    throw new Error(`Unexpected query in suggested-question latency test: ${sql}`);
  };
  geminiModel.generateContent = async () => {
    aiStarted = true;
    return new Promise((resolve) => { resolveAi = resolve; });
  };

  let deadline;
  try {
    const result = await Promise.race([
      getSuggestedQuestionsByLessonId(46),
      new Promise((_, reject) => {
        deadline = setTimeout(() => reject(new Error('request waited for background Gemini')), 250);
      })
    ]);
    clearTimeout(deadline);

    assert.equal(result.length, 4);
    assert.equal(result.contentAvailable, true);
    assert.equal(result.generatedByAi, false);
    assert.equal(result.refreshing, true);
    assert.equal(result.every((question) => /“[^”]+”/.test(question)), true);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(aiStarted, true);

    resolveAi({
      response: {
        text: () => JSON.stringify({
          items: [
            { question: 'Small talk giúp hội thoại tự nhiên như thế nào?', evidence: 'Small talk helps everyday conversations feel natural' },
            { question: 'Friendly greetings được dùng trước tình huống nào?', evidence: 'friendly greetings before meeting a new colleague' },
            { question: 'Nice to meet you được nói khi nào?', evidence: 'nice to meet you when meeting a colleague' },
            { question: 'Everyday conversations liên hệ với small talk ra sao?', evidence: 'Small talk helps everyday conversations' }
          ]
        })
      }
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(savedCount, 1);
  } finally {
    clearTimeout(deadline);
    db.query = originalQuery;
    geminiModel.generateContent = originalGenerateContent;
  }
});
