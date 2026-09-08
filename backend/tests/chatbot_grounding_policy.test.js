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
const { getRagNamespace, getRagIndex } = require('../src/utils/ragIndex.util');

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
  assert.equal(hasUsableGrounding('Verified transcript content', source, { hasContentEvidence: true }), true);
  assert.equal(hasUsableGrounding('Lesson title only', source), false);
  assert.equal(hasUsableGrounding('Lesson title only', source, { allowMetadataOnly: true }), true);
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
  const gatePattern = 'if (groundingRequired && !hasUsableGrounding(contextText, verifiedEvidence.sources, { hasContentEvidence, allowMetadataOnly }))';
  const firstGate = source.indexOf(gatePattern);
  const secondGate = source.indexOf(gatePattern, firstGate + gatePattern.length);
  const syncGeneration = source.indexOf('geminiModel.generateContent(generationRequest)');
  const streamGeneration = source.indexOf('geminiModel.generateContentStream(generationRequest)');

  assert.ok(firstGate >= 0 && firstGate < syncGeneration);
  assert.ok(secondGate > firstGate && secondGate < streamGeneration);
  assert.match(source, /const verifiedEvidence = await buildVerifiedEvidence/);
  assert.match(source, /getPromptGroundingRules\(groundingRequired\)/);
  assert.equal((source.match(/async generateQuiz\(/g) || []).length, 1, 'generateQuiz must not be overridden');
  assert.match(source, /shouldUseTranscriptWindow\(question\)/);
  assert.match(source, /course_status/);
  assert.match(source, /WHERE LOWER\(CAST\(status AS TEXT\)\) IN \('published', '1'\)/);
});

test('RAG reads and writes use the same versioned Pinecone namespace', () => {
  const previousVersion = process.env.ACTIVE_RAG_VERSION;
  const previousNamespace = process.env.PINECONE_NAMESPACE_V2;
  process.env.ACTIVE_RAG_VERSION = 'v2';
  process.env.PINECONE_NAMESPACE_V2 = 'verified-rag-v2';
  const calls = [];
  const index = { namespace: value => { calls.push(value); return { scoped: value }; } };

  assert.equal(getRagNamespace(), 'verified-rag-v2');
  assert.deepEqual(getRagIndex(index), { scoped: 'verified-rag-v2' });
  assert.deepEqual(calls, ['verified-rag-v2']);

  if (previousVersion === undefined) delete process.env.ACTIVE_RAG_VERSION;
  else process.env.ACTIVE_RAG_VERSION = previousVersion;
  if (previousNamespace === undefined) delete process.env.PINECONE_NAMESPACE_V2;
  else process.env.PINECONE_NAMESPACE_V2 = previousNamespace;
});

test('RAG ingestion separates metadata IDs and exposes stale-vector cleanup', () => {
  const ingestionPath = path.join(__dirname, '..', 'src', 'modules', 'lessons', 'services', 'ragIngestion.service.js');
  const source = fs.readFileSync(ingestionPath, 'utf8');
  assert.match(source, /v2-metadata-chunk/);
  assert.match(source, /v2-transcript-chunk/);
  assert.match(source, /async function deleteLessonVectors/);
  assert.match(source, /createEmbeddingWithRetry/);
  assert.match(source, /RAG_EMBEDDING_MIN_INTERVAL_MS/);
  assert.match(source, /targetIndex\.upsert\(records\)/);
  const recordsPreparedAt = source.indexOf('const records = []');
  const replacementDeleteAt = source.indexOf('await deleteLessonVectors(lessonId, source, options.materialId);', recordsPreparedAt);
  assert.ok(recordsPreparedAt >= 0 && replacementDeleteAt > recordsPreparedAt, 'old vectors are deleted only after embeddings are prepared');
});
