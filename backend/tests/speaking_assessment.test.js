/**
 * Automated Test Suite for Speaking Assessment Engine (TASK-AI-SPEAKING-01-HOTFIX-R2)
 * 
 * Đảm bảo:
 * 1. Không phụ thuộc vào kết nối mạng hoặc Gemini API Key khi chạy npm test.
 * 2. Mock AI Model phản hồi có kiểm soát để kiểm thử toàn diện các trường hợp biên.
 * 3. Kiểm tra triệt để: Model Resolution, Strict Validation, Magic Bytes, HTTP 413, Score Cap, Contractions, Repeated Words.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const speakingScorer = require('../src/utils/speakingScorer');
const speakingValidator = require('../src/utils/speakingValidator');
const { getSpeakingModelName, DEFAULT_GEMINI_SPEAKING_MODEL, geminiSpeakingModel } = require('../src/utils/ai-clients');
const chatbotRoutes = require('../src/modules/chatbot/chatbot.routes');
const errorHandler = require('../src/middleware/error.middleware');

describe('=== TASK-AI-SPEAKING-01-HOTFIX-R2 AUTOMATED TEST SUITE ===', () => {
  let server;
  let baseUrl;
  const fixturesDir = path.join(__dirname, 'fixtures', 'speaking');

  // Backup and Mocking state
  let originalEvaluateSpeaking;
  let originalEnv;

  before(async () => {
    originalEnv = { ...process.env };
    originalEvaluateSpeaking = geminiSpeakingModel.evaluateSpeaking;

    // Thiết lập Express app kiểm thử sử dụng đúng production upload middleware, magic bytes, controller và error middleware
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const upload = require('../src/middleware/upload.middleware');
    const chatbotController = require('../src/modules/chatbot/controllers/chatbot.controller');

    const testRouter = express.Router();
    testRouter.use((req, res, next) => {
      req.user = { id: 1, role: 'student', email: 'test@example.com' };
      next();
    });
    testRouter.post('/audio', upload.audioMemory.single('audio'), upload.verifyAudioMagicBytes, chatbotController.processAudio);

    app.use('/api/chatbot', testRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    geminiSpeakingModel.evaluateSpeaking = originalEvaluateSpeaking;
    process.env = originalEnv;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // =========================================================================
  // 1. MODEL RESOLUTION & CONFIGURATION TESTS
  // =========================================================================
  describe('1. Model Resolution & Centralized Configuration', () => {
    it('1.1 should resolve to GEMINI_SPEAKING_MODEL when defined', () => {
      const savedSpeaking = process.env.GEMINI_SPEAKING_MODEL;
      const savedGeneral = process.env.GEMINI_MODEL;
      try {
        process.env.GEMINI_SPEAKING_MODEL = 'gemini-3.7-flash-custom';
        process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
        assert.strictEqual(getSpeakingModelName(), 'gemini-3.7-flash-custom');
      } finally {
        process.env.GEMINI_SPEAKING_MODEL = savedSpeaking;
        process.env.GEMINI_MODEL = savedGeneral;
      }
    });

    it('1.2 should fallback to GEMINI_MODEL when GEMINI_SPEAKING_MODEL is not set', () => {
      const savedSpeaking = process.env.GEMINI_SPEAKING_MODEL;
      const savedGeneral = process.env.GEMINI_MODEL;
      try {
        delete process.env.GEMINI_SPEAKING_MODEL;
        process.env.GEMINI_MODEL = 'gemini-3.7-flash-general';
        assert.strictEqual(getSpeakingModelName(), 'gemini-3.7-flash-general');
      } finally {
        process.env.GEMINI_SPEAKING_MODEL = savedSpeaking;
        process.env.GEMINI_MODEL = savedGeneral;
      }
    });

    it('1.3 should fallback to gemini-3.7-flash when neither env variable is set', () => {
      const savedSpeaking = process.env.GEMINI_SPEAKING_MODEL;
      const savedGeneral = process.env.GEMINI_MODEL;
      try {
        delete process.env.GEMINI_SPEAKING_MODEL;
        delete process.env.GEMINI_MODEL;
        assert.strictEqual(getSpeakingModelName(), DEFAULT_GEMINI_SPEAKING_MODEL);
        assert.strictEqual(DEFAULT_GEMINI_SPEAKING_MODEL, 'gemini-3.7-flash');
      } finally {
        process.env.GEMINI_SPEAKING_MODEL = savedSpeaking;
        process.env.GEMINI_MODEL = savedGeneral;
      }
    });
  });

  // =========================================================================
  // 2. STRICT VALIDATOR TESTS (NO AUTO-CLAMPING / NO STRING BOOLEANS)
  // =========================================================================
  describe('2. Strict Speaking AI Validator (Zero Malformed Trust)', () => {
    it('2.1 should REJECT string "true" and "false" for hasSpeech', () => {
      assert.throws(() => {
        speakingValidator.validateStrictBoolean("true", "hasSpeech");
      }, /hasSpeech.*boolean/i);

      assert.throws(() => {
        speakingValidator.validateStrictBoolean("false", "hasSpeech");
      }, /hasSpeech.*boolean/i);

      assert.strictEqual(speakingValidator.validateStrictBoolean(true), true);
      assert.strictEqual(speakingValidator.validateStrictBoolean(false), false);
    });

    it('2.2 should REJECT non-number scores ("85", "85%", NaN, Infinity)', () => {
      assert.throws(() => {
        speakingValidator.validateStrictScore("85", "pronunciationScore");
      }, /hợp lệ/i);

      assert.throws(() => {
        speakingValidator.validateStrictScore("85%", "pronunciationScore");
      }, /hợp lệ/i);

      assert.throws(() => {
        speakingValidator.validateStrictScore(NaN, "pronunciationScore");
      }, /hợp lệ/i);

      assert.throws(() => {
        speakingValidator.validateStrictScore(Infinity, "pronunciationScore");
      }, /hợp lệ/i);
    });

    it('2.3 should REJECT out-of-range scores (<0 or >100) without auto-clamping', () => {
      assert.throws(() => {
        speakingValidator.validateStrictScore(-5, "fluencyScore");
      }, /0-100/i);

      assert.throws(() => {
        speakingValidator.validateStrictScore(120, "fluencyScore");
      }, /0-100/i);

      assert.strictEqual(speakingValidator.validateStrictScore(85, "fluencyScore"), 85);
    });

    it('2.4 should REJECT Read Aloud schema when hasSpeech is true but scores are missing', () => {
      assert.throws(() => {
        speakingValidator.validateReadAloudResponse({
          hasSpeech: true,
          transcription: "Hello world"
          // Missing pronunciationScore & fluencyScore
        });
      }, /Thiếu trường điểm bắt buộc/i);
    });

    it('2.5 should properly validate well-formed Read Aloud and QA schemas', () => {
      const validReadAloud = speakingValidator.validateReadAloudResponse({
        hasSpeech: true,
        transcription: "Welcome to the course",
        pronunciationScore: 90,
        fluencyScore: 85,
        wordAssessments: [
          { word: "welcome", occurrenceIndex: 0, status: "correct", confidence: 0.95 }
        ],
        quality: "good"
      });
      assert.strictEqual(validReadAloud.hasSpeech, true);
      assert.strictEqual(validReadAloud.pronunciationScore, 90);
      assert.strictEqual(validReadAloud.wordAssessments[0].confidence, 0.95);

      const validQA = speakingValidator.validateQAResponse({
        hasSpeech: true,
        transcription: "I practice English everyday",
        relevanceScore: 90,
        grammarScore: 85,
        vocabularyScore: 80,
        pronunciationScore: 85,
        fluencyScore: 85,
        quality: "good"
      });
      assert.strictEqual(validQA.hasSpeech, true);
      assert.strictEqual(validQA.scores.relevance, 90);
    });
  });

  // =========================================================================
  // 3. CONTRACTION ALIGNMENT & REPEATED WORDS TESTS
  // =========================================================================
  describe('3. Contraction Alignment & Repeated Words (Scorer Engine)', () => {
    it('3.1 Contraction: should evaluate "don\'t" vs "do not" without word splitting', () => {
      const res = speakingScorer.calculateReadAloudScore({
        targetText: "I don't know the answer",
        transcription: "I do not know the answer",
        pronunciationScore: 90,
        fluencyScore: 90
      });

      assert.strictEqual(res.components.contentAccuracy, 100);
      assert.strictEqual(res.components.completeness, 100);
      assert.strictEqual(res.overallScore >= 90, true);
    });

    it('3.2 Repeated Words: Occurrence index must increment for missing, substituted and correct words', () => {
      // Target: "practice practice makes perfect"
      // Student: "practice makes perfect" (first practice missing)
      const words = speakingScorer.buildWordLevelFeedback(
        "practice practice makes perfect",
        "practice makes perfect",
        [
          { word: "practice", occurrenceIndex: 1, status: "correct", feedback: "Second occurrence pronounced well" }
        ]
      );

      const practiceEntries = words.filter(w => w.word.toLowerCase() === 'practice');
      assert.strictEqual(practiceEntries.length, 2);

      // First practice: missing
      assert.strictEqual(practiceEntries[0].textMatch, 'missing');
      assert.strictEqual(practiceEntries[0].acousticStatus, 'not_assessed');

      // Second practice: correct_text and matched with occurrenceIndex: 1
      assert.strictEqual(practiceEntries[1].textMatch, 'correct_text');
      assert.strictEqual(practiceEntries[1].acousticStatus, 'correct');
      assert.strictEqual(practiceEntries[1].feedback, "Second occurrence pronounced well");
    });

    it('3.3 Repeated Words: Missing repeated word at end should not misalign previous words', () => {
      const words = speakingScorer.buildWordLevelFeedback(
        "day by day",
        "day by",
        [
          { word: "day", occurrenceIndex: 0, status: "correct", feedback: "Good day 1" }
        ]
      );

      const dayEntries = words.filter(w => w.word.toLowerCase() === 'day');
      assert.strictEqual(dayEntries.length, 2);
      assert.strictEqual(dayEntries[0].textMatch, 'correct_text');
      assert.strictEqual(dayEntries[0].acousticStatus, 'correct');
      assert.strictEqual(dayEntries[1].textMatch, 'missing');
      assert.strictEqual(dayEntries[1].acousticStatus, 'not_assessed');
    });
  });

  // =========================================================================
  // 4. HTTP UPLOAD, MAGIC BYTES & HTTP 413 TESTS
  // =========================================================================
  describe('4. Audio Upload, Magic Bytes & Error Handling', () => {
    it('4.1 should return HTTP 400 UNSUPPORTED_AUDIO_TYPE when uploading PDF file', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 Fake PDF Content');
      const formData = new FormData();
      formData.append('audio', new Blob([fakePdf], { type: 'application/pdf' }), 'document.pdf');
      formData.append('mode', 'read_aloud');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.code, 'UNSUPPORTED_AUDIO_TYPE');
    });

    it('4.2 should return HTTP 400 UNSUPPORTED_AUDIO_TYPE when uploading PDF renamed to document.mp3 (Magic Bytes mismatch)', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 Renamed PDF Document Header');
      const formData = new FormData();
      formData.append('audio', new Blob([fakePdf], { type: 'audio/mpeg' }), 'document.mp3');
      formData.append('mode', 'read_aloud');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.code, 'UNSUPPORTED_AUDIO_TYPE');
    });

    it('4.3 should return HTTP 413 AUDIO_TOO_LARGE when uploading audio > 10 MB', async () => {
      // 10.5 MB buffer
      const largeBuffer = Buffer.alloc(10.5 * 1024 * 1024);
      // Giả lập WAV header để qua bước MIME
      largeBuffer.write('RIFF', 0);
      largeBuffer.write('WAVE', 8);

      const formData = new FormData();
      formData.append('audio', new Blob([largeBuffer], { type: 'audio/wav' }), 'huge_audio.wav');
      formData.append('mode', 'read_aloud');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 413);
      assert.strictEqual(data.code, 'AUDIO_TOO_LARGE');
    });

    it('4.4 should return HTTP 422 AUDIO_TOO_SHORT when audio duration < 1.0s', async () => {
      const tooShortPath = path.join(fixturesDir, 'too_short.wav');
      const fileBuf = fs.existsSync(tooShortPath) ? fs.readFileSync(tooShortPath) : Buffer.alloc(100);

      const formData = new FormData();
      formData.append('audio', new Blob([fileBuf], { type: 'audio/wav' }), 'too_short.wav');
      formData.append('mode', 'read_aloud');
      formData.append('targetText', 'Hello');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 422);
      assert.strictEqual(data.code, 'AUDIO_TOO_SHORT');
    });

    it('4.5 should return HTTP 422 AUDIO_TOO_LONG when audio duration > 120.0s', async () => {
      const tooLongPath = path.join(fixturesDir, 'too_long.wav');
      if (!fs.existsSync(tooLongPath)) {
        return; // Skip if large fixture omitted in test runner
      }

      const fileBuf = fs.readFileSync(tooLongPath);
      const formData = new FormData();
      formData.append('audio', new Blob([fileBuf], { type: 'audio/wav' }), 'too_long.wav');
      formData.append('mode', 'read_aloud');
      formData.append('targetText', 'Hello');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 422);
      assert.strictEqual(data.code, 'AUDIO_TOO_LONG');
    });
  });

  // =========================================================================
  // 5. INTEGRATION TESTS (WITH MOCKED GEMINI MODEL)
  // =========================================================================
  describe('5. Speaking Evaluation Integration (Mocked AI)', () => {
    it('5.1 Read Aloud: should evaluate successfully and return accurate modelUsed', async () => {
      // Mock AI response for valid Read Aloud
      geminiSpeakingModel.evaluateSpeaking = async () => ({
        responseText: JSON.stringify({
          hasSpeech: true,
          transcription: "Welcome to the course",
          pronunciationScore: 92,
          fluencyScore: 88,
          wordAssessments: [
            { word: "welcome", occurrenceIndex: 0, status: "correct", confidence: 0.95, feedback: "Phát âm tốt" },
            { word: "to", occurrenceIndex: 0, status: "correct", confidence: 0.95, feedback: "Tốt" },
            { word: "the", occurrenceIndex: 0, status: "correct", confidence: 0.95, feedback: "Tốt" },
            { word: "course", occurrenceIndex: 0, status: "correct", confidence: 0.95, feedback: "Phát âm chuẩn" }
          ],
          quality: "good",
          noiseLevel: "low",
          warning: null
        }),
        modelUsed: "gemini-3.7-flash"
      });

      const validWav = path.join(fixturesDir, 'speech_sample.wav');
      const fileBuf = fs.existsSync(validWav) ? fs.readFileSync(validWav) : Buffer.alloc(4000);

      const formData = new FormData();
      formData.append('audio', new Blob([fileBuf], { type: 'audio/wav' }), 'speech.wav');
      formData.append('mode', 'read_aloud');
      formData.append('targetText', 'Welcome to the course');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.mode, 'read_aloud');
      assert.strictEqual(data.data.modelUsed, 'gemini-3.7-flash');
      assert.strictEqual(data.data.overallScore > 85, true);
    });

    it('5.2 Q&A: should apply Score Cap when relevance < 20', async () => {
      geminiSpeakingModel.evaluateSpeaking = async () => ({
        responseText: JSON.stringify({
          hasSpeech: true,
          transcription: "I like eating pizza and playing video games",
          relevanceScore: 10, // Off-topic
          grammarScore: 90,
          vocabularyScore: 85,
          pronunciationScore: 90,
          fluencyScore: 85,
          quality: "good"
        }),
        modelUsed: "gemini-3.7-flash"
      });

      const validWav = path.join(fixturesDir, 'speech_sample.wav');
      const fileBuf = fs.existsSync(validWav) ? fs.readFileSync(validWav) : Buffer.alloc(4000);

      const formData = new FormData();
      formData.append('audio', new Blob([fileBuf], { type: 'audio/wav' }), 'speech.wav');
      formData.append('mode', 'qa');
      formData.append('questionText', 'How do you practice English?');
      formData.append('questionId', 'q-1');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.mode, 'qa');
      assert.strictEqual(data.data.scoreCapApplied, true);
      assert.strictEqual(data.data.overallScore <= 49, true);
    });

    it('5.3 Invalid AI Schema: should retry once and return HTTP 503 AI_RESPONSE_INVALID', async () => {
      let callCount = 0;
      geminiSpeakingModel.evaluateSpeaking = async () => {
        callCount++;
        return {
          responseText: "Invalid JSON non-parseable response {{{{",
          modelUsed: "gemini-3.7-flash"
        };
      };

      const validWav = path.join(fixturesDir, 'speech_sample.wav');
      const fileBuf = fs.existsSync(validWav) ? fs.readFileSync(validWav) : Buffer.alloc(4000);

      const formData = new FormData();
      formData.append('audio', new Blob([fileBuf], { type: 'audio/wav' }), 'speech.wav');
      formData.append('mode', 'read_aloud');
      formData.append('targetText', 'Hello');

      const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      assert.strictEqual(res.status, 503);
      assert.strictEqual(data.code, 'AI_RESPONSE_INVALID');
      assert.strictEqual(callCount, 2, "Must retry exactly once (total 2 attempts)");
    });
  });
});
