'use strict';

const db = require('../../../config/database');

const STOP_WORDS = new Set([
  'ai', 'bai', 'ban', 'cach', 'cau', 'cho', 'co', 'cua', 'duoc', 'giao', 'gi', 'hoc',
  'huong', 'khi', 'la', 'mot', 'nay', 'nhu', 'noi', 'ra', 'sao', 'the', 'thi', 'trong',
  'tu', 'va', 've', 'vi', 'what', 'when', 'where', 'which', 'why', 'how', 'does', 'do',
  'did', 'is', 'are', 'was', 'were', 'the', 'this', 'that', 'lesson', 'video', 'teacher',
  'explain', 'explains', 'explained', 'use', 'used', 'using'
]);

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value = '') {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length >= 2 && !STOP_WORDS.has(token));
}

function cueText(cue = {}) {
  return [cue.en, cue.vi, cue.text]
    .filter(Boolean)
    .map(value => String(value).replace(/\s+/g, ' ').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(' ');
}

function parseCues(rawCues) {
  if (Array.isArray(rawCues)) return rawCues;
  if (typeof rawCues !== 'string') return [];
  try {
    const parsed = JSON.parse(rawCues);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function findStoredEvidence(questions, question) {
  let items = questions;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { return ''; }
  }
  if (!Array.isArray(items)) return '';

  const normalizedQuestion = normalizeText(question);
  const found = items.find(item => (
    item && typeof item === 'object' && normalizeText(item.question) === normalizedQuestion
  ));
  return typeof found?.evidence === 'string' ? found.evidence.trim() : '';
}

function findBestTranscriptEvidence(cuesInput, question, evidenceHint = '') {
  const cues = parseCues(cuesInput)
    .map((cue, index) => ({
      ...cue,
      _index: index,
      _text: cueText(cue),
      _normalized: normalizeText(cueText(cue)),
      _start: Number(cue?.start),
      _end: Number(cue?.end)
    }))
    .filter(cue => cue._text && Number.isFinite(cue._start) && cue._start >= 0);

  if (cues.length === 0) return null;

  const normalizedHint = normalizeText(evidenceHint);
  const hintTokens = meaningfulTokens(evidenceHint);
  const questionTokens = [...new Set(meaningfulTokens(question))];
  const quotedPhrases = [...String(question).matchAll(/[“"']([^”"']{2,})[”"']/g)]
    .map(match => normalizeText(match[1]))
    .filter(Boolean);
  const searchTokens = hintTokens.length > 0 ? [...new Set(hintTokens)] : questionTokens;

  if (searchTokens.length === 0 && quotedPhrases.length === 0 && !normalizedHint) return null;

  let best = null;

  // Evidence do server lưu được ưu tiên tuyệt đối. Chọn khoảng cue ngắn nhất chứa
  // nguyên văn evidence để mốc thời gian không bị nới rộng sang nội dung lân cận.
  if (normalizedHint) {
    for (let span = 1; span <= 3 && !best; span += 1) {
      for (let index = 0; index + span <= cues.length; index += 1) {
        const normalizedSpan = normalizeText(cues.slice(index, index + span).map(cue => cue._text).join(' '));
        if (normalizedSpan.includes(normalizedHint)) {
          best = {
            anchorStart: index,
            anchorEnd: index + span - 1,
            exactHint: true,
            coverage: 1,
            matchedTokens: hintTokens,
            phraseMatches: []
          };
          break;
        }
      }
    }
  }

  // Fallback cho bộ gợi ý deterministic chưa kịp được lưu: chấm điểm từng cue
  // theo cụm từ trong dấu ngoặc kép và từ khóa có nghĩa của chính câu hỏi.
  if (!best) {
    for (let index = 0; index < cues.length; index += 1) {
      const normalizedCue = cues[index]._normalized;
      const matchedTokens = searchTokens.filter(token => normalizedCue.includes(token));
      const questionMatches = questionTokens.filter(token => normalizedCue.includes(token));
      const phraseMatches = quotedPhrases.filter(phrase => normalizedCue.includes(phrase));
      const coverage = searchTokens.length > 0 ? matchedTokens.length / searchTokens.length : 0;
      const score = phraseMatches.length * 12 + matchedTokens.length * 3 + questionMatches.length + coverage * 5;

      if (!best || score > best.score) {
        best = {
          anchorStart: index,
          anchorEnd: index,
          score,
          coverage,
          matchedTokens,
          exactHint: false,
          phraseMatches
        };
      }
    }
  }

  const hasReliableHint = normalizedHint
    ? (best.exactHint || best.coverage >= 0.65)
    : false;
  const hasReliableQuestionMatch = !normalizedHint && (
    best.phraseMatches.length > 0
    || best.matchedTokens.length >= Math.min(2, searchTokens.length)
    || (searchTokens.length === 1 && best.coverage === 1)
  );

  if (!hasReliableHint && !hasReliableQuestionMatch) return null;

  const anchorCues = cues.slice(best.anchorStart, best.anchorEnd + 1);
  const firstAnchorCue = anchorCues[0];
  const lastAnchorCue = anchorCues[anchorCues.length - 1];
  const endTime = Number.isFinite(lastAnchorCue._end) && lastAnchorCue._end >= firstAnchorCue._start
    ? lastAnchorCue._end
    : firstAnchorCue._start;
  const contextCues = cues.slice(
    Math.max(0, best.anchorStart - 1),
    Math.min(cues.length, best.anchorEnd + 2)
  );
  const lines = contextCues.map(cue => {
    const label = formatTimestamp(cue._start);
    return `[${label}] ${cue._text}`;
  });

  return {
    contextSnippet: `ĐOẠN VIDEO ĐÃ XÁC MINH TRẢ LỜI CÂU HỎI (không tự tạo mốc thời gian khác):\n${lines.join('\n')}`,
    startTime: firstAnchorCue._start,
    endTime,
    evidence: evidenceHint || firstAnchorCue._text,
    cuesFound: true
  };
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function getSuggestedQuestionTranscriptContext(lessonId, question) {
  const parsedLessonId = Number(lessonId);
  if (!Number.isFinite(parsedLessonId) || parsedLessonId <= 0 || !String(question || '').trim()) {
    return null;
  }

  try {
    const result = await db.query(`
      SELECT ls.cues, q.questions
      FROM lessons l
      LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
      LEFT JOIN lesson_suggested_questions q ON q.lesson_id = l.lesson_id
      WHERE l.lesson_id = $1
      LIMIT 1
    `, [parsedLessonId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const storedEvidence = findStoredEvidence(row.questions, question);
    return findBestTranscriptEvidence(row.cues, question, storedEvidence);
  } catch (error) {
    console.warn(`[Transcript Evidence] Không thể tìm mốc video cho lessonId=${parsedLessonId}:`, error.message);
    return null;
  }
}

module.exports = {
  normalizeText,
  meaningfulTokens,
  findStoredEvidence,
  findBestTranscriptEvidence,
  getSuggestedQuestionTranscriptContext
};
