const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');
const quizzesController = require('../src/modules/quizzes/controllers/quizzes.controller');

// Mock data representing all 6 question types with sensitive answers that must NEVER leak to students
const mockQuestionsAllTypes = [
  {
    question_id: 101,
    question_text: 'What is the capital of England?',
    options: ['London', 'Paris', 'Berlin', 'Rome'],
    correct_answer: 'A',
    explanation: 'London is the capital of England.',
    question_type: 'multiple_choice',
    audio_url: null,
    passage_text: null
  },
  {
    question_id: 102,
    question_text: 'Write a paragraph about your morning routine.',
    options: [],
    correct_answer: 'Sample model essay that should not leak.',
    explanation: 'Focus on simple present tense.',
    question_type: 'writing',
    audio_url: null,
    passage_text: null
  },
  {
    question_id: 103,
    question_text: 'Read aloud: Practice makes perfect.',
    options: [],
    correct_answer: 'Practice makes perfect.',
    explanation: 'IPA /' + 'præktɪs meɪks ˈpɜːrfɪkt/',
    question_type: 'pronunciation',
    audio_url: null,
    passage_text: null
  },
  {
    question_id: 104,
    question_text: 'The climate {{1}} rapidly and {{2}} biodiversity.',
    options: [
      { id: '1', answer: 'changes', acceptedAnswers: ['shifts'], hint: 'verb' },
      { id: '2', answer: 'threatens', acceptedAnswers: ['endangers'], hint: 'verb' }
    ],
    correct_answer: '',
    explanation: 'Present continuous or simple.',
    question_type: 'open_cloze',
    audio_url: null,
    passage_text: null
  },
  {
    question_id: 105,
    question_text: 'What time did the train arrive according to the speaker?',
    options: ['8:15 AM', '8:45 AM', '9:15 AM', '9:45 AM'],
    correct_answer: 'B',
    explanation: 'The speaker mentions forty-five minutes past eight.',
    question_type: 'listening',
    audio_url: 'https://r2.cdn.example.com/audio/listening_test_105.mp3',
    passage_text: null
  },
  {
    question_id: 106,
    question_text: 'According to the passage, why is sleep essential?',
    options: ['Memory consolidation', 'Eye exercise', 'Digestive pause', 'Muscular rigidity'],
    correct_answer: 'A',
    explanation: 'Paragraph 2 highlights neural replay and memory consolidation.',
    question_type: 'reading',
    audio_url: null,
    passage_text: 'Sleep plays an essential role in human cognitive health. During slow-wave sleep, memory consolidation occurs...'
  }
];

const mockQuizData = {
  quiz_id: 99,
  course_id: 10,
  lesson_id: 20,
  title: 'Comprehensive 6-Skill Assessment',
  description: 'Testing multiple choice, writing, speaking, cloze, listening, and reading',
  difficulty: 'Medium',
  time_limit: 15,
  is_private: false,
  pin_code: 'PIN999',
  questions: mockQuestionsAllTypes
};

const createMockResponse = () => ({
  statusCode: 0,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

describe('Security: Public Quiz Endpoints Zero Answer Leakage Policy', () => {
  it('GET /api/quizzes/:courseId (getQuizzes): hides correct_answer for ALL 6 question types', async () => {
    const originalGetQuizzesByCourseId = quizzesService.getQuizzesByCourseId;
    quizzesService.getQuizzesByCourseId = async () => [mockQuizData];

    const res = createMockResponse();

    try {
      await quizzesController.getQuizzes({ params: { courseId: '10' } }, res, err => { throw err; });
      assert.equal(res.statusCode, 200);

      const quiz = res.body.data[0];
      assert.equal(quiz.questions.length, 6);

      for (const q of quiz.questions) {
        // Assert correct_answer is completely wiped/empty - NEVER contains 'A', 'B', 'Practice makes perfect', or cloze answers
        assert.equal(q.correct_answer, '', `Leak detected for question_type: ${q.question_type}`);
        assert.notEqual(q.correct_answer, 'A');
        assert.notEqual(q.correct_answer, 'B');
        assert.notEqual(q.correct_answer, 'Practice makes perfect.');
      }

      // Verify listening question contains audio_url
      const listeningQ = quiz.questions.find(q => q.question_type === 'listening');
      assert.ok(listeningQ, 'Listening question must be present');
      assert.equal(listeningQ.audio_url, 'https://r2.cdn.example.com/audio/listening_test_105.mp3');

      // Verify reading question contains passage_text
      const readingQ = quiz.questions.find(q => q.question_type === 'reading');
      assert.ok(readingQ, 'Reading question must be present');
      assert.match(readingQ.passage_text, /Sleep plays an essential role/);

      // Verify open_cloze gaps have no answer or acceptedAnswers
      const clozeQ = quiz.questions.find(q => q.question_type === 'open_cloze');
      assert.ok(clozeQ.options.every(gap => !Object.hasOwn(gap, 'answer') && !Object.hasOwn(gap, 'acceptedAnswers')));
    } finally {
      quizzesService.getQuizzesByCourseId = originalGetQuizzesByCourseId;
    }
  });

  it('GET /api/quizzes/detail/:quizId (getQuizById): hides correct_answer for ALL 6 question types', async () => {
    const originalGetQuizById = quizzesService.getQuizById;
    quizzesService.getQuizById = async () => mockQuizData;

    const res = createMockResponse();

    try {
      await quizzesController.getQuizById({ params: { quizId: '99' } }, res, err => { throw err; });
      assert.equal(res.statusCode, 200);

      const quiz = res.body.data;
      assert.equal(quiz.questions.length, 6);

      for (const q of quiz.questions) {
        assert.equal(q.correct_answer, '', `Leak detected in getQuizById for question_type: ${q.question_type}`);
        assert.notEqual(q.correct_answer, 'A');
        assert.notEqual(q.correct_answer, 'B');
      }

      // Verify new types have their respective content
      const listeningQ = quiz.questions.find(q => q.question_type === 'listening');
      assert.equal(listeningQ.audio_url, 'https://r2.cdn.example.com/audio/listening_test_105.mp3');

      const readingQ = quiz.questions.find(q => q.question_type === 'reading');
      assert.match(readingQ.passage_text, /Sleep plays an essential role/);
    } finally {
      quizzesService.getQuizById = originalGetQuizById;
    }
  });

  it('GET /api/quizzes/join-by-pin/:pinCode (getQuizByPin): hides correct_answer for ALL 6 question types', async () => {
    const originalGetQuizByPin = quizzesService.getQuizByPin;
    quizzesService.getQuizByPin = async () => mockQuizData;

    const res = createMockResponse();

    try {
      await quizzesController.getQuizByPin({ params: { pinCode: 'PIN999' } }, res, err => { throw err; });
      assert.equal(res.statusCode, 200);

      const quiz = res.body.data;
      assert.equal(quiz.questions.length, 6);

      for (const q of quiz.questions) {
        assert.equal(q.correct_answer, '', `Leak detected in getQuizByPin for question_type: ${q.question_type}`);
      }
    } finally {
      quizzesService.getQuizByPin = originalGetQuizByPin;
    }
  });

  it('Management endpoint preserves correct_answer, audio_url, and passage_text for instructors/admins', async () => {
    const originalGetQuizzesByCourseId = quizzesService.getQuizzesByCourseId;
    quizzesService.getQuizzesByCourseId = async () => [mockQuizData];

    const res = createMockResponse();

    try {
      await quizzesController.getQuizzesForManagement({ params: { courseId: '10' } }, res, err => { throw err; });
      assert.equal(res.statusCode, 200);

      const quiz = res.body.data[0];
      const mcq = quiz.questions.find(q => q.question_type === 'multiple_choice');
      assert.equal(mcq.correct_answer, 'A', 'Management endpoint must preserve correct_answer');

      const listeningQ = quiz.questions.find(q => q.question_type === 'listening');
      assert.equal(listeningQ.correct_answer, 'B');
      assert.equal(listeningQ.audio_url, 'https://r2.cdn.example.com/audio/listening_test_105.mp3');

      const readingQ = quiz.questions.find(q => q.question_type === 'reading');
      assert.equal(readingQ.correct_answer, 'A');
      assert.match(readingQ.passage_text, /Sleep plays an essential role/);
    } finally {
      quizzesService.getQuizzesByCourseId = originalGetQuizzesByCourseId;
    }
  });
});
