'use strict';

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const { geminiModel } = require('../src/utils/ai-clients');
const youtubeTranscript = require('../src/utils/youtubeTranscript.util');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
const subtitlesController = require('../src/modules/lessons/controllers/subtitles.controller');
const ragIngestion = require('../src/modules/lessons/services/ragIngestion.service');

const originals = {
  dbQuery: db.query,
  generateContent: geminiModel.generateContent,
  fetchYoutubeTranscript: youtubeTranscript.fetchYoutubeTranscript,
  setSubtitleStatus: subtitlesService.setSubtitleStatus,
  saveSubtitles: subtitlesService.saveSubtitles,
  downloadVideoToTemp: subtitlesService.downloadVideoToTemp,
  extractAudio: subtitlesService.extractAudio,
  runSilenceVadPipeline: subtitlesService.runSilenceVadPipeline,
  ingestLessonTranscript: ragIngestion.ingestLessonTranscript,
  getSubtitleStatus: subtitlesService.getSubtitleStatus
};

const youtubeLesson = {
  lesson_id: 321,
  content_type: 'video',
  content_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  storage_key: null,
  storage_bucket: null,
  storage_provider: 'youtube'
};

afterEach(() => {
  db.query = originals.dbQuery;
  geminiModel.generateContent = originals.generateContent;
  youtubeTranscript.fetchYoutubeTranscript = originals.fetchYoutubeTranscript;
  subtitlesService.setSubtitleStatus = originals.setSubtitleStatus;
  subtitlesService.saveSubtitles = originals.saveSubtitles;
  subtitlesService.downloadVideoToTemp = originals.downloadVideoToTemp;
  subtitlesService.extractAudio = originals.extractAudio;
  subtitlesService.runSilenceVadPipeline = originals.runSilenceVadPipeline;
  ragIngestion.ingestLessonTranscript = originals.ingestLessonTranscript;
  subtitlesService.getSubtitleStatus = originals.getSubtitleStatus;
});

describe('YouTube transcript subtitle pipeline', () => {
  test('extractYoutubeVideoId supports common YouTube URL formats', () => {
    assert.equal(
      youtubeTranscript.extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4'),
      'dQw4w9WgXcQ'
    );
    assert.equal(
      youtubeTranscript.extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc'),
      'dQw4w9WgXcQ'
    );
    assert.equal(
      youtubeTranscript.extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );
    assert.equal(
      youtubeTranscript.extractYoutubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );
    assert.equal(
      youtubeTranscript.extractYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'),
      null
    );
    assert.equal(youtubeTranscript.extractYoutubeVideoId('dQw4w9WgXcQ'), null);
    assert.equal(
      youtubeTranscript.normalizeYoutubeUrl(
        'https://www.youtube.com/watch?v=KiNV60Ce7kE&t=283shttps://www.youtube.com/watch?v=KiNV60Ce7kE&t=283s'
      ),
      'https://www.youtube.com/watch?v=KiNV60Ce7kE'
    );
  });

  test('distinguishes a real missing-caption result from temporary YouTube blocking', () => {
    assert.equal(
      youtubeTranscript.classifyYoutubeTranscriptError(new Error('No caption tracks available')),
      'no_captions'
    );
    assert.equal(
      youtubeTranscript.classifyYoutubeTranscriptError(new Error('Caption fetch failed: 429')),
      'rate_limited'
    );
    assert.equal(
      youtubeTranscript.classifyYoutubeTranscriptError(new Error('Sign in to confirm you are not a bot')),
      'access_blocked'
    );
    assert.equal(
      youtubeTranscript.classifyYoutubeTranscriptError(new Error('Video unavailable in your region')),
      'video_unavailable'
    );
  });

  test('caps YouTube translation batches by character count and cue count', () => {
    const cues = Array.from({ length: 120 }, (_, index) => ({ id: index + 1, en: 'short line' }));
    const batches = subtitlesService.createYoutubeTranslationBatches(cues, 6000, 50);

    assert.ok(batches.length > 1);
    assert.equal(batches.flat().length, cues.length);
    assert.ok(batches.every(batch => batch.length <= 50));
    assert.deepEqual(batches.flat().map(cue => cue.id), cues.map(cue => cue.id));
  });

  test('uses structured JSON and recovers a malformed Gemini batch by splitting only that batch', async () => {
    const requests = [];
    geminiModel.generateContent = async request => {
      requests.push(request);
      if (requests.length === 1) {
        return { response: { text: () => '{"translations":[' } };
      }

      const ids = request.generationConfig.responseJsonSchema.properties.translations.items.properties.id.enum;
      return {
        response: {
          text: () => JSON.stringify({
            translations: ids.map(id => ({ id, vi: `Bản dịch ${id}` }))
          })
        }
      };
    };

    const result = await subtitlesService.translateYoutubeTranscriptWithGemini([
      { start: 0, duration: 1, text: 'Line one.' },
      { start: 1, duration: 1, text: 'Line two.' },
      { start: 2, duration: 1, text: 'Line three.' },
      { start: 3, duration: 1, text: 'Line four.' }
    ]);

    assert.equal(requests.length, 3);
    assert.equal(requests[0].generationConfig.temperature, 0);
    assert.equal(requests[0].generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(
      requests[0].generationConfig.responseJsonSchema.properties.translations.items.properties.id.enum,
      [1, 2, 3, 4]
    );
    assert.deepEqual(result.map(cue => cue.vi), [
      'Bản dịch 1',
      'Bản dịch 2',
      'Bản dịch 3',
      'Bản dịch 4'
    ]);
  });

  test('recovers a malformed single-cue JSON response with a plain-text translation', async () => {
    let calls = 0;
    geminiModel.generateContent = async request => {
      calls += 1;
      if (calls === 1) return { response: { text: () => '{invalid json' } };
      assert.equal(request.purpose, 'subtitle_translation_youtube_recovery');
      assert.equal(request.generationConfig.responseMimeType, 'text/plain');
      return { response: { text: () => 'Xin chào cả lớp.' } };
    };

    const result = await subtitlesService.translateYoutubeTranscriptWithGemini([
      { start: 0, duration: 2, text: 'Hello class.' }
    ]);

    assert.equal(calls, 2);
    assert.equal(result[0].vi, 'Xin chào cả lớp.');
  });

  test('creates bilingual cues, saves ready subtitles, and ingests RAG once without media processing', async () => {
    db.query = async sql => {
      if (String(sql).includes('FROM lessons WHERE lesson_id')) return { rows: [youtubeLesson] };
      return { rows: [] };
    };

    youtubeTranscript.fetchYoutubeTranscript = async videoId => {
      assert.equal(videoId, 'dQw4w9WgXcQ');
      return [
        { start: 0.5, duration: 2.25, text: 'Welcome to the lesson.' },
        { start: 3, duration: 1.5, text: 'Let us begin.' }
      ];
    };

    let geminiRequest;
    geminiModel.generateContent = async request => {
      geminiRequest = request;
      return {
        response: {
          text: () => JSON.stringify({
            translations: [
              { id: 1, vi: 'Chào mừng đến với bài học.' },
              { id: 2, vi: 'Chúng ta hãy bắt đầu.' }
            ]
          })
        }
      };
    };

    const forbiddenCalls = { download: 0, extract: 0, vad: 0 };
    subtitlesService.downloadVideoToTemp = async () => { forbiddenCalls.download += 1; };
    subtitlesService.extractAudio = async () => { forbiddenCalls.extract += 1; };
    subtitlesService.runSilenceVadPipeline = async () => {
      forbiddenCalls.vad += 1;
      return [];
    };

    let savedPayload;
    subtitlesService.saveSubtitles = async (lessonId, payload) => {
      savedPayload = { lessonId, payload };
      return { subtitle_id: 99, lesson_id: lessonId, ...payload };
    };

    let ingestionCalls = 0;
    let ingestedCues;
    ragIngestion.ingestLessonTranscript = async (lessonId, cues) => {
      ingestionCalls += 1;
      assert.equal(lessonId, 321);
      ingestedCues = cues;
    };

    const result = await subtitlesService._generateSubtitlesWithGemini(321);

    assert.equal(geminiRequest.purpose, 'subtitle_translation_youtube');
    assert.deepEqual(forbiddenCalls, { download: 0, extract: 0, vad: 0 });
    assert.equal(savedPayload.lessonId, 321);
    assert.equal(savedPayload.payload.subtitle_status, 'ready');
    assert.match(savedPayload.payload.en_vtt, /Welcome to the lesson\./);
    assert.match(savedPayload.payload.vi_vtt, /Chào mừng đến với bài học\./);
    assert.equal(savedPayload.payload.cues.length, 2);
    assert.deepEqual(savedPayload.payload.cues[0], {
      id: 1,
      start: 0.5,
      end: 2.75,
      startFormatted: '00:00:00.500',
      endFormatted: '00:00:02.750',
      en: 'Welcome to the lesson.',
      vi: 'Chào mừng đến với bài học.'
    });
    assert.equal(ingestionCalls, 1);
    assert.strictEqual(ingestedCues, savedPayload.payload.cues);
    assert.equal(result.subtitle_status, 'ready');
  });

  test('keeps saved subtitles ready when optional RAG ingestion is temporarily unavailable', async () => {
    db.query = async sql => {
      if (String(sql).includes('FROM lessons WHERE lesson_id')) return { rows: [youtubeLesson] };
      return { rows: [] };
    };
    youtubeTranscript.fetchYoutubeTranscript = async () => [
      { start: 0, duration: 2, text: 'Welcome.' }
    ];
    geminiModel.generateContent = async () => ({
      response: {
        text: () => JSON.stringify({ translations: [{ id: 1, vi: 'Chào mừng.' }] })
      }
    });

    const statusWrites = [];
    subtitlesService.setSubtitleStatus = async (lessonId, status) => {
      statusWrites.push({ lessonId, status });
    };
    subtitlesService.saveSubtitles = async (lessonId, payload) => ({
      subtitle_id: 100,
      lesson_id: lessonId,
      ...payload
    });
    ragIngestion.ingestLessonTranscript = async () => {
      const error = new Error('Pinecone quota is temporarily unavailable');
      error.code = 'RESOURCE_EXHAUSTED';
      throw error;
    };

    const result = await subtitlesService._generateSubtitlesWithGemini(321);

    assert.equal(result.subtitle_status, 'ready');
    assert.deepEqual(statusWrites, [{ lessonId: 321, status: 'processing' }]);
  });

  test('stores the dedicated failed status when public captions are unavailable', async () => {
    db.query = async sql => {
      if (String(sql).includes('FROM lessons WHERE lesson_id')) return { rows: [youtubeLesson] };
      return { rows: [] };
    };

    youtubeTranscript.fetchYoutubeTranscript = async () => {
      const error = new Error(youtubeTranscript.YOUTUBE_NO_CAPTIONS_MESSAGE);
      error.code = 'YOUTUBE_NO_CAPTIONS_AVAILABLE';
      throw error;
    };

    const statusWrites = [];
    subtitlesService.setSubtitleStatus = async (lessonId, status, sourceContentUrl, details) => {
      statusWrites.push({ lessonId, status, sourceContentUrl, details });
    };

    let downloadCalls = 0;
    let extractCalls = 0;
    let vadCalls = 0;
    subtitlesService.downloadVideoToTemp = async () => { downloadCalls += 1; };
    subtitlesService.extractAudio = async () => { extractCalls += 1; };
    subtitlesService.runSilenceVadPipeline = async () => { vadCalls += 1; return []; };

    await assert.rejects(
      () => subtitlesService._generateSubtitlesWithGemini(321),
      error => (
        error.code === 'YOUTUBE_NO_CAPTIONS_AVAILABLE' &&
        error.message === youtubeTranscript.YOUTUBE_NO_CAPTIONS_MESSAGE
      )
    );

    assert.equal(downloadCalls, 0);
    assert.equal(extractCalls, 0);
    assert.equal(vadCalls, 0);
    assert.equal(statusWrites.length, 2);
    assert.deepEqual(statusWrites[1], {
      lessonId: 321,
      status: 'failed',
      sourceContentUrl: youtubeLesson.content_url,
      details: {
        code: 'YOUTUBE_NO_CAPTIONS_AVAILABLE',
        message: youtubeTranscript.YOUTUBE_NO_CAPTIONS_MESSAGE
      }
    });
  });

  test('subtitle status endpoint exposes the public YouTube failure details', async () => {
    db.query = async sql => {
      assert.match(String(sql), /error_code, error_message/);
      return {
        rows: [{
          subtitle_status: 'failed',
          error_code: 'YOUTUBE_NO_CAPTIONS_AVAILABLE',
          error_message: youtubeTranscript.YOUTUBE_NO_CAPTIONS_MESSAGE,
          updated_at: '2026-09-07T00:00:00.000Z'
        }]
      };
    };

    let responseBody;
    await subtitlesController.getSubtitleStatus(
      { params: { lessonId: '321' } },
      {
        status(code) {
          assert.equal(code, 200);
          return this;
        },
        json(body) {
          responseBody = body;
          return body;
        }
      },
      error => { throw error; }
    );

    assert.equal(responseBody.data.status, 'failed');
    assert.equal(responseBody.data.code, 'YOUTUBE_NO_CAPTIONS_AVAILABLE');
    assert.equal(responseBody.data.message, youtubeTranscript.YOUTUBE_NO_CAPTIONS_MESSAGE);
  });
});
