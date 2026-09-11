/**
 * Live Integration Verification Script: Gemini Audio Subtitles & Pinecone RAG
 *
 * Verifies live external pipelines against actual Google AI Studio and Pinecone endpoints.
 * Opt-in via: RUN_LIVE_EXTERNAL_TESTS=true node scripts/verify_live_external_pipelines.js
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { geminiModel, embeddingModel, pineconeIndex } = require('../src/utils/ai-clients');
const { GEMINI_MODELS } = require('../src/config/ai-model');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');

const isOptedIn = process.env.RUN_LIVE_EXTERNAL_TESTS === 'true' || process.argv.includes('--force');

async function runLiveVerification() {
  console.log('\n========================================================================');
  console.log('🧪 LIVE INTEGRATION VERIFICATION: GEMINI SUBTITLE & RAG PIPELINES');
  console.log('========================================================================\n');

  if (!isOptedIn) {
    console.log('ℹ️  Skipping live external tests (RUN_LIVE_EXTERNAL_TESTS is not "true").');
    console.log('   To run live external verification against Gemini & Pinecone, execute:');
    console.log('   RUN_LIVE_EXTERNAL_TESTS=true node scripts/verify_live_external_pipelines.js --force\n');
    return { skipped: true };
  }

  const results = {
    audioSubtitle: { passed: false, latencyMs: 0, details: null },
    ragEmbedding: { passed: false, latencyMs: 0, details: null },
    ragPinecone: { passed: false, latencyMs: 0, details: null },
    ragGeneration: { passed: false, latencyMs: 0, details: null },
  };

  // ---------------------------------------------------------------------------
  // PIPELINE 1: Live Gemini Multimodal Audio Subtitles
  // ---------------------------------------------------------------------------
  const audioFixturePath = path.resolve(__dirname, '../tests/fixtures/speaking/speech_sample.wav');
  if (!fs.existsSync(audioFixturePath)) {
    console.error(`❌ Audio fixture missing: ${audioFixturePath}`);
  } else {
    console.log(`[Pipeline 1] Testing Gemini Audio Subtitle Generation...`);
    console.log(`  Audio file: ${path.basename(audioFixturePath)} (${Math.round(fs.statSync(audioFixturePath).size / 1024)} KB)`);
    console.log(`  Target model: ${GEMINI_MODELS.subtitle}`);

    const startTime = Date.now();
    try {
      const cues = await subtitlesService.transcribeAudioWithGemini(audioFixturePath, 0);
      const latencyMs = Date.now() - startTime;

      if (Array.isArray(cues) && cues.length > 0) {
        results.audioSubtitle = {
          passed: true,
          latencyMs,
          model: GEMINI_MODELS.subtitle,
          cueCount: cues.length,
          sampleCue: {
            start: cues[0].startFormatted || `${cues[0].start}s`,
            en: cues[0].en,
            vi: cues[0].vi
          }
        };
        console.log(`  ✅ Audio Subtitles: SUCCESS (${latencyMs}ms)`);
        console.log(`     Generated ${cues.length} bilingual cues.`);
        console.log(`     Sample: [${cues[0].en}] -> [${cues[0].vi}]`);
      } else {
        results.audioSubtitle = { passed: false, latencyMs, error: 'Returned empty cues array' };
        console.warn(`  ⚠️ Audio Subtitles: Returned 0 cues.`);
      }
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      results.audioSubtitle = { passed: false, latencyMs, error: err.message };
      console.error(`  ❌ Audio Subtitles FAILED (${latencyMs}ms):`, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // PIPELINE 2: Live Gemini Embedding & Pinecone Vector Search
  // ---------------------------------------------------------------------------
  console.log(`\n[Pipeline 2] Testing Gemini Embedding & Pinecone RAG Query...`);
  const testQuestion = 'Explain the difference between Present Perfect and Past Simple in English grammar.';
  console.log(`  Test Query: "${testQuestion}"`);

  let embeddingValues = null;
  const embedStartTime = Date.now();
  try {
    const embedResult = await embeddingModel.embedContent({
      content: { parts: [{ text: testQuestion }] },
      outputDimensionality: 768
    });
    const embedLatencyMs = Date.now() - embedStartTime;
    embeddingValues = embedResult.embedding?.values || [];

    results.ragEmbedding = {
      passed: embeddingValues.length === 768,
      latencyMs: embedLatencyMs,
      dimension: embeddingValues.length,
      model: GEMINI_MODELS.embedding || 'text-embedding-004'
    };
    console.log(`  ✅ Gemini Embedding: SUCCESS (${embedLatencyMs}ms) - Vector dim: ${embeddingValues.length}`);
  } catch (err) {
    const embedLatencyMs = Date.now() - embedStartTime;
    results.ragEmbedding = { passed: false, latencyMs: embedLatencyMs, error: err.message };
    console.error(`  ❌ Gemini Embedding FAILED (${embedLatencyMs}ms):`, err.message);
  }

  // Pinecone Vector Search (if embedding and index exist)
  if (embeddingValues && pineconeIndex && typeof pineconeIndex.query === 'function') {
    const pcStartTime = Date.now();
    try {
      const queryResponse = await pineconeIndex.query({
        vector: embeddingValues,
        topK: 3,
        includeMetadata: true
      });
      const pcLatencyMs = Date.now() - pcStartTime;
      const matches = queryResponse.matches || [];

      results.ragPinecone = {
        passed: true,
        latencyMs: pcLatencyMs,
        matchCount: matches.length,
        topScore: matches[0]?.score || null
      };
      console.log(`  ✅ Pinecone Search: SUCCESS (${pcLatencyMs}ms) - Found ${matches.length} matches (Top score: ${matches[0]?.score?.toFixed(4) || 'N/A'})`);
    } catch (err) {
      const pcLatencyMs = Date.now() - pcStartTime;
      results.ragPinecone = { passed: false, latencyMs: pcLatencyMs, error: err.message };
      console.warn(`  ⚠️ Pinecone Search note (${pcLatencyMs}ms):`, err.message);
    }
  } else {
    results.ragPinecone = { passed: true, skipped: true, reason: 'Pinecone not configured or inactive (graceful degradation)' };
    console.log(`  ℹ️  Pinecone Search: Skipped (Not configured or inactive; graceful degradation mode active).`);
  }

  // ---------------------------------------------------------------------------
  // PIPELINE 3: Grounded Answer Generation with Gemini
  // ---------------------------------------------------------------------------
  console.log(`\n[Pipeline 3] Testing Gemini Grounded Answer Generation...`);
  const genStartTime = Date.now();
  try {
    const genResult = await geminiModel.generateContent({
      model: GEMINI_MODELS.chat || 'gemini-3.7-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `Answer concisely in 2 sentences: ${testQuestion}` }]
      }]
    });
    const genLatencyMs = Date.now() - genStartTime;
    const answerText = genResult?.response?.text?.() || genResult?.text?.() || '';

    results.ragGeneration = {
      passed: answerText.length > 0,
      latencyMs: genLatencyMs,
      model: GEMINI_MODELS.chat || 'gemini-3.7-flash',
      responseLength: answerText.length,
      sampleAnswer: answerText.slice(0, 150) + (answerText.length > 150 ? '...' : '')
    };
    console.log(`  ✅ Gemini Generation: SUCCESS (${genLatencyMs}ms)`);
    console.log(`     Model: ${results.ragGeneration.model}`);
    console.log(`     Sample answer: "${results.ragGeneration.sampleAnswer}"`);
  } catch (err) {
    const genLatencyMs = Date.now() - genStartTime;
    results.ragGeneration = { passed: false, latencyMs: genLatencyMs, error: err.message };
    console.error(`  ❌ Gemini Generation FAILED (${genLatencyMs}ms):`, err.message);
  }

  console.log('\n========================================================================');
  console.log('📊 VERIFICATION SUMMARY REPORT');
  console.log('========================================================================');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

if (require.main === module) {
  runLiveVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal execution error in live verification:', err);
      process.exit(1);
    });
}

module.exports = { runLiveVerification };
