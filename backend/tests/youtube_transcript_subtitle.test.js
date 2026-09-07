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
