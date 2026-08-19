/**
 * Automated Test Suite for Speaking Assessment Engine V2
 * - Unit tests: Token Alignment, Levenshtein, WER Clamping, Score Cap.
 * - Integration tests: Express Routes, Validation, Mode Resolution, Legacy ChatBox Compatibility.
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const speakingScorer = require('../src/utils/speakingScorer');
const express = require('express');
const request = require('http');

describe('=== UNIT TESTS: Speaking Scorer & Token Alignment Engine ===', () => {

  describe('1. Text Normalization & Contractions Expansion', () => {
    it('should normalize uppercase, trim whitespace and remove punctuations', () => {
      const input = "Hello, World! How are you doing today???";
      const tokens = speakingScorer.normalizeAndTokenize(input);
      assert.deepStrictEqual(tokens, ['hello', 'world', 'how', 'are', 'you', 'doing', 'today']);
    });

    it('should expand contractions when requested', () => {
      const input = "I don't think it's working, but let's try!";
      const tokens = speakingScorer.normalizeAndTokenize(input, true);
      assert.deepStrictEqual(tokens, ['i', 'do', 'not', 'think', 'it', 'is', 'working', 'but', 'let', 'us', 'try']);
    });

    it('should handle empty or invalid inputs gracefully', () => {
      assert.deepStrictEqual(speakingScorer.normalizeAndTokenize(''), []);
      assert.deepStrictEqual(speakingScorer.normalizeAndTokenize(null), []);
      assert.deepStrictEqual(speakingScorer.normalizeAndTokenize(undefined), []);
    });
  });

  describe('2. Token Alignment, Levenshtein & WER Clamping', () => {
    it('should score 100% accuracy and completeness on exact word matches', () => {
      const target = "Welcome to the English communication course";
      const transcript = "welcome to the english communication course";
      const res = speakingScorer.calculateReadAloudScore({
        targetText: target,
        transcription: transcript,
        pronunciationScore: 90,
        fluencyScore: 85
      });

      assert.strictEqual(res.components.contentAccuracy, 100);
      assert.strictEqual(res.components.completeness, 100);
      // Overall = 90*0.35 + 100*0.30 + 85*0.20 + 100*0.15 = 31.5 + 30 + 17 + 15 = 93.5 -> 94
      assert.strictEqual(res.overallScore, 94);
      assert.strictEqual(res.words.length, 6);
      assert.ok(res.words.every(w => w.textMatch === 'correct_text'));
    });

    it('should identify missing words and adjust completeness proportionally', () => {
      const target = "Practice makes perfect every single day"; // 6 words
      const transcript = "practice makes perfect"; // missing 3 words
      const res = speakingScorer.calculateReadAloudScore({
        targetText: target,
        transcription: transcript,
        pronunciationScore: 80,
        fluencyScore: 80
      });

      assert.strictEqual(res.components.completeness, 50); // 3/6 = 50%
      const missingWords = res.words.filter(w => w.textMatch === 'missing');
      assert.strictEqual(missingWords.length, 3);
      assert.strictEqual(missingWords[0].word, 'every');
    });

    it('should identify extra and substituted words', () => {
      const target = "I study English everyday";
      const transcript = "I study Spanish very everyday";
      const targetTokens = speakingScorer.normalizeAndTokenize(target);
      const transcriptTokens = speakingScorer.normalizeAndTokenize(transcript);
      const alignment = speakingScorer.computeTokenAlignment(targetTokens, transcriptTokens);

      assert.ok(alignment.substitutions > 0 || alignment.insertions > 0);
    });

    it('should clamp Content Accuracy to 0 when completely different sentence is spoken (WER >= 1.0)', () => {
      const target = "The quick brown fox jumps over the lazy dog";
      const transcript = "Completely unrelated words that do not match anything here at all";
      const res = speakingScorer.calculateReadAloudScore({
        targetText: target,
        transcription: transcript,
        pronunciationScore: 70,
        fluencyScore: 70
      });

      assert.strictEqual(res.components.contentAccuracy, 0); // Must be clamped at 0, not negative
      assert.ok(res.overallScore >= 0 && res.overallScore <= 100);
    });

    it('should handle silent or empty transcription correctly', () => {
      const target = "Good morning";
      const res = speakingScorer.calculateReadAloudScore({
        targetText: target,
        transcription: "",
        pronunciationScore: 0,
        fluencyScore: 0
      });

      assert.strictEqual(res.overallScore, 0);
      assert.strictEqual(res.components.completeness, 0);
      assert.strictEqual(res.components.contentAccuracy, 0);
      assert.strictEqual(res.words.length, 2);
      assert.strictEqual(res.words[0].textMatch, 'missing');
    });
  });

  describe('3. Disjoint Word-Level Feedback Schema & Priority', () => {
    it('should assign mispronounced only when acoustic evidence is present', () => {
      const target = "Learning English is exciting";
      const transcript = "Learning English is exciting";
      const aiMispronounced = [{ word: "exciting", feedback: "Thiếu âm đuôi /tɪŋ/" }];

      const words = speakingScorer.buildWordLevelFeedback(target, transcript, aiMispronounced);
      const excitingWord = words.find(w => w.word === 'exciting');

      assert.strictEqual(excitingWord.textMatch, 'correct_text');
      assert.strictEqual(excitingWord.acousticStatus, 'mispronounced');
      assert.ok(excitingWord.feedback.includes("Thiếu âm đuôi"));

      const learningWord = words.find(w => w.word === 'learning');
      assert.strictEqual(learningWord.textMatch, 'correct_text');
      assert.strictEqual(learningWord.acousticStatus, 'correct');
    });
  });

  describe('4. Q&A Rubric Scoring & Score Cap Anti-Cheat Rules', () => {
    it('should apply strict Score Cap (overallScore <= 49) when relevance < 20 even if pronunciation/grammar are 100', () => {
      const res = speakingScorer.calculateQAScore({
        relevance: 10,       // Lạc đề hoàn toàn
        grammar: 100,
        vocabulary: 100,
        pronunciation: 100,
        fluency: 100
      });

      // Raw score = 10*0.2 + 100*0.2 + 100*0.15 + 100*0.25 + 100*0.20 = 2 + 20 + 15 + 25 + 20 = 82
      // Score cap rule: relevance < 20 -> max score 49 (Fail)
      assert.strictEqual(res.overallScore, 49);
      assert.strictEqual(res.scoreCapApplied, true);
      assert.ok(res.scoreCapReason.includes("Lạc đề") || res.scoreCapReason.includes("Relevance < 20%"));
    });

    it('should apply Score Cap (overallScore <= 59) when relevance is 20-39', () => {
      const res = speakingScorer.calculateQAScore({
        relevance: 30,       // Hơi lan man, chưa đúng trọng tâm
        grammar: 90,
        vocabulary: 90,
        pronunciation: 90,
        fluency: 90
      });

      // Raw score = 30*0.2 + 90*0.8 = 6 + 72 = 78
      // Score cap rule: 20 <= relevance < 40 -> max score 59 (Weak)
      assert.strictEqual(res.overallScore, 59);
      assert.strictEqual(res.scoreCapApplied, true);
    });

    it('should NOT apply score cap when relevance >= 40', () => {
      const res = speakingScorer.calculateQAScore({
        relevance: 85,
        grammar: 85,
        vocabulary: 80,
        pronunciation: 90,
        fluency: 85
      });

      // Raw score = 85*0.2 + 85*0.2 + 80*0.15 + 90*0.25 + 85*0.20 = 17 + 17 + 12 + 22.5 + 17 = 85.5 -> 86
      assert.strictEqual(res.overallScore, 86);
      assert.strictEqual(res.scoreCapApplied, false);
    });
  });
});

describe('=== INTEGRATION TESTS: Chatbot & Speaking Audio API Endpoint ===', () => {
  const chatbotController = require('../src/modules/chatbot/controllers/chatbot.controller');
  const chatbotService = require('../src/modules/chatbot/services/chatbot.service');
  const upload = require('../src/middleware/upload.middleware');

  let app;
  let server;
  let baseUrl;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Mock router endpoint
    app.post('/api/chatbot/audio', upload.memory.single('audio'), chatbotController.processAudio);

    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
      });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    try {
      const db = require('../src/config/database');
      if (db.pool) await db.pool.end();
    } catch (e) {}
  });

  it('should return HTTP 400 when no audio file is uploaded', async () => {
    const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'read_aloud', targetText: 'Hello' })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('file âm thanh'));
  });

  it('should return HTTP 400 when invalid mode is provided', async () => {
    const formData = new FormData();
    const fakeAudio = new Blob([Buffer.from('fake audio data for test 12345')], { type: 'audio/webm' });
    formData.append('audio', fakeAudio, 'test.webm');
    formData.append('mode', 'invalid_mode_xyz');

    const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('mode không hợp lệ'));
  });

  it('should return HTTP 400 when mode=read_aloud is missing targetText', async () => {
    const formData = new FormData();
    const fakeAudio = new Blob([Buffer.from('fake audio data for test 12345')], { type: 'audio/webm' });
    formData.append('audio', fakeAudio, 'test.webm');
    formData.append('mode', 'read_aloud');

    const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Thiếu targetText'));
  });

  it('should return HTTP 400 when mode=qa is missing questionText', async () => {
    const formData = new FormData();
    const fakeAudio = new Blob([Buffer.from('fake audio data for test 12345')], { type: 'audio/webm' });
    formData.append('audio', fakeAudio, 'test.webm');
    formData.append('mode', 'qa');

    const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Thiếu questionText'));
  });

  it('LEGACY CHATBOX COMPATIBILITY: request without mode, targetText, isQA should map to mode=chat and return 200', async () => {
    const formData = new FormData();
    const fakeAudio = new Blob([Buffer.from('short audio buffer for silence test')], { type: 'audio/webm' });
    formData.append('audio', fakeAudio, 'voice.webm');
    formData.append('lessonId', '1');

    const res = await fetch(`${baseUrl}/api/chatbot/audio`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.mode, 'chat');
    assert.ok(data.data.reply !== undefined);
  });
});
