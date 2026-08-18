/**
 * Hybrid Search, Lesson Grouping & Reranking Service (Phase 6)
 * - Kết hợp Semantic Search (Pinecone Vector DB) + Lexical Search (PostgreSQL)
 * - Gom nhóm theo bài học (Lesson Grouping) ngăn 1 bài học chiếm hết Top-K
 * - Tái xếp hạng đa nhân tố (Deterministic Reranking: Semantic + Lexical + Exact Title Boost)
 * - Bộ lọc ngưỡng tự tin (Confidence / No-result Threshold) loại bỏ OOD queries
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const db = require('../../../config/database');

const CONFIDENCE_THRESHOLD = 0.58; // Ngưỡng tự tin tối ưu dựa trên phân phối điểm số (Relevant >= 0.619, OOD < 0.55)

/**
 * 1. Lexical Search trên PostgreSQL (Tìm kiếm chính xác trên Title, Section, Subtitles, Materials)
 * @param {string} query Chuỗi tìm kiếm
 * @param {number} courseId Mã khóa học đã xác thực
 * @returns {Promise<Array<{lessonId: number, lessonTitle: string, sectionTitle: string, lexicalScore: number, matchReason: string}>>}
 */
async function searchPostgreSQLLexical(query, courseId) {
  if (!query || !courseId) return [];
  const q = query.trim().toLowerCase();
  const cleanQ = q
    .replace(/^(bài\s+nào\s+dạy|bài\s+nào\s+nói\s+về|bài\s+nào\s+giải\s+thích|học\s+xong\s+bài\s+này\s+tôi\s+nên\s+học\s+bài\s+nào|đưa\s+tôi\s+tới\s+bài|chuyển\s+tới\s+bài|mở\s+bài|cho\s+tôi\s+xem\s+bài|bài\s+học\s+về|học\s+về|tìm\s+bài)\s*/i, '')
    .replace(/[?!.,;]/g, '')
    .trim();

  try {
    const sql = `
      SELECT 
        l.lesson_id,
        l.title AS lesson_title,
        s.title AS section_title,
        COALESCE(sub.en_vtt, '') AS en_vtt,
        COALESCE(sub.vi_vtt, '') AS vi_vtt,
        COALESCE(mat.file_name, '') AS material_name
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      LEFT JOIN lesson_subtitles sub ON l.lesson_id = sub.lesson_id
      LEFT JOIN lesson_materials mat ON l.lesson_id = mat.lesson_id
      WHERE s.course_id = $1
    `;

    const res = await db.query(sql, [courseId]);
    const lessonsMap = new Map();

    const queryTokens = (cleanQ || q).split(/\s+/).filter(t => t.length >= 3);

    for (const row of res.rows) {
      const lessonId = row.lesson_id;
      const lessonTitle = row.lesson_title || '';
      const sectionTitle = row.section_title || '';
      const ltLower = lessonTitle.toLowerCase();
      const stLower = sectionTitle.toLowerCase();
      const enVtt = row.en_vtt.toLowerCase();
      const viVtt = row.vi_vtt.toLowerCase();
      const matName = row.material_name.toLowerCase();

      let lexicalScore = 0;
      let matchReason = '';

      // A. Khớp chính xác tiêu đề bài học (Exact Title Match)
      if (ltLower === cleanQ || ltLower === q) {
        lexicalScore = 1.0;
        matchReason = 'exact_lesson_title';
      } else if (cleanQ.length >= 3 && (ltLower.includes(cleanQ) || (cleanQ.length >= 6 && cleanQ.includes(ltLower)))) {
        lexicalScore = 0.95;
        matchReason = 'clean_lesson_title';
      } else if (ltLower.includes(q) || (q.length >= 4 && q.includes(ltLower))) {
        lexicalScore = 0.90;
        matchReason = 'partial_lesson_title';
      }
      // B. Khớp tiêu đề chương học (Section Title Match)
      else if (stLower === cleanQ || (cleanQ.length >= 4 && stLower.includes(cleanQ)) || stLower === q || (q.length >= 4 && stLower.includes(q))) {
        lexicalScore = Math.max(lexicalScore, 0.75);
        matchReason = 'section_title';
      }
      // C. Khớp từ khóa trong tên tài liệu đính kèm (Material Name Match)
      else if (matName && (matName.includes(cleanQ) || matName.includes(q))) {
        lexicalScore = Math.max(lexicalScore, 0.70);
        matchReason = 'material_name';
      }
      // D. Khớp từ khóa trong phụ đề kịch bản (Subtitle VTT Match)
      else if ((enVtt && (enVtt.includes(cleanQ) || enVtt.includes(q))) || (viVtt && (viVtt.includes(cleanQ) || viVtt.includes(q)))) {
        lexicalScore = Math.max(lexicalScore, 0.68);
        matchReason = 'subtitle_content';
      }
      // E. Khớp Bigram (2 từ liền kề) trong tiêu đề (ví dụ: "phương pháp nghe")
      else {
        const cleanTokens = (cleanQ || q).split(/\s+/).filter(t => t.length >= 2);
        for (let i = 0; i < cleanTokens.length - 1; i++) {
          const bigram = cleanTokens[i] + ' ' + cleanTokens[i+1];
          if (bigram.length >= 6 && (ltLower.includes(bigram) || stLower.includes(bigram))) {
            lexicalScore = Math.max(lexicalScore, 0.85);
            matchReason = 'bigram_match: ' + bigram;
            break;
          }
        }
      }

      // F. Khớp tỷ lệ Token Overlap nếu có từ khóa quan trọng
      if (lexicalScore === 0 && queryTokens.length > 0) {
        const matchedTokens = queryTokens.filter(tok => ltLower.includes(tok) || stLower.includes(tok));
        if (matchedTokens.length === queryTokens.length && queryTokens.length >= 2) {
          lexicalScore = Math.max(lexicalScore, 0.85);
          matchReason = 'all_tokens_title_match';
        } else if (matchedTokens.length >= 1 && queryTokens.length === 1) {
          lexicalScore = Math.max(lexicalScore, 0.72);
          matchReason = 'single_token_title_match';
        }
      }

      if (lexicalScore > 0) {
        if (!lessonsMap.has(lessonId) || lessonsMap.get(lessonId).lexicalScore < lexicalScore) {
          lessonsMap.set(lessonId, {
            lessonId,
            lessonTitle,
            sectionTitle,
            lexicalScore,
            matchReason
          });
        }
      }
    }

    return Array.from(lessonsMap.values());
  } catch (err) {
    console.warn('[Hybrid Search Warning] Lỗi PostgreSQL Lexical Search:', err.message);
    return [];
  }
}

/**
 * 2. Hợp nhất (Candidate Merge) & Gom nhóm theo bài học (Lesson Grouping) & Tái xếp hạng (Reranking)
 * @param {Array} vectorMatches Danh sách matches từ Pinecone
 * @param {Array} lexicalMatches Danh sách matches từ PostgreSQL
 * @param {string} query Chuỗi truy vấn gốc
 * @param {Object} options Cấu hình Top-K và Threshold
 * @returns {Array<{lessonId: number, lessonTitle: string, sectionTitle: string, rerankScore: number, semanticScore: number, lexicalScore: number, chunks: Array<string>}>}
 */
function mergeGroupAndRerank(vectorMatches = [], lexicalMatches = [], query = '', options = {}) {
  const topK = options.topK || 3;
  const threshold = options.confidenceThreshold !== undefined ? options.confidenceThreshold : CONFIDENCE_THRESHOLD;
  const q = (query || '').trim().toLowerCase();
  const cleanQ = q
    .replace(/^(bài\s+nào\s+dạy|bài\s+nào\s+nói\s+về|bài\s+nào\s+giải\s+thích|học\s+xong\s+bài\s+này\s+tôi\s+nên\s+học\s+bài\s+nào|đưa\s+tôi\s+tới\s+bài|chuyển\s+tới\s+bài|mở\s+bài|cho\s+tôi\s+xem\s+bài|bài\s+học\s+về|học\s+về|tìm\s+bài)\s*/i, '')
    .replace(/[?!.,;]/g, '')
    .trim();

  const lessonsGroup = new Map();

  // A. Nạp và gom nhóm kết quả từ Semantic Vector Search
  for (const vMatch of vectorMatches) {
    const meta = vMatch.metadata || {};
    const lessonId = meta.lesson_id;
    if (!lessonId) continue;

    const vecScore = typeof vMatch.score === 'number' ? vMatch.score : 0;
    const chunkText = meta.text || meta.content || meta.context || '';

    if (!lessonsGroup.has(lessonId)) {
      lessonsGroup.set(lessonId, {
        lessonId,
        lessonTitle: meta.lesson_title || '',
        sectionTitle: meta.section_title || '',
        semanticScore: vecScore,
        lexicalScore: 0,
        chunks: chunkText ? [chunkText] : [],
        rawMatches: [vMatch]
      });
    } else {
      const g = lessonsGroup.get(lessonId);
      if (vecScore > g.semanticScore) {
        g.semanticScore = vecScore;
      }
      if (chunkText && g.chunks.length < 2) {
        g.chunks.push(chunkText);
      }
      g.rawMatches.push(vMatch);
    }
  }

  // B. Nạp và hợp nhất kết quả từ Lexical Search
  for (const lex of lexicalMatches) {
    const lessonId = lex.lessonId;
    if (!lessonsGroup.has(lessonId)) {
      lessonsGroup.set(lessonId, {
        lessonId,
        lessonTitle: lex.lessonTitle,
        sectionTitle: lex.sectionTitle,
        semanticScore: 0,
        lexicalScore: lex.lexicalScore,
        chunks: [],
        rawMatches: []
      });
    } else {
      const g = lessonsGroup.get(lessonId);
      g.lexicalScore = Math.max(g.lexicalScore, lex.lexicalScore);
      if (!g.lessonTitle && lex.lessonTitle) g.lessonTitle = lex.lessonTitle;
      if (!g.sectionTitle && lex.sectionTitle) g.sectionTitle = lex.sectionTitle;
    }
  }

  // C. Tính điểm Reranking đa nhân tố (Deterministic Reranking Formula)
  const rankedLessons = [];

  for (const [lessonId, item] of lessonsGroup.entries()) {
    const sem = item.semanticScore;
    const lex = item.lexicalScore;
    const ltLower = (item.lessonTitle || '').toLowerCase();

    // Exact lesson title boost
    let exactTitleBoost = 0;
    if (ltLower && (ltLower === cleanQ || (cleanQ.length >= 3 && ltLower.includes(cleanQ)) || ltLower === q || (q.length >= 4 && ltLower.includes(q)))) {
      exactTitleBoost = 0.15;
    }

    let baseScore = 0;
    if (sem > 0 && lex > 0) {
      baseScore = (0.60 * sem) + (0.40 * lex);
    } else if (sem > 0) {
      baseScore = sem;
    } else {
      baseScore = 0.85 * lex;
    }

    const rerankScore = Math.min(1.0, baseScore + exactTitleBoost);

    // Kiểm tra ngưỡng tự tin tối thiểu (OOD Rejection)
    if (rerankScore >= threshold) {
      rankedLessons.push({
        lessonId,
        lessonTitle: item.lessonTitle,
        sectionTitle: item.sectionTitle,
        rerankScore: Number(rerankScore.toFixed(3)),
        semanticScore: Number(sem.toFixed(3)),
        lexicalScore: Number(lex.toFixed(3)),
        chunks: item.chunks,
        matchCount: item.rawMatches ? item.rawMatches.length : 1
      });
    }
  }

  // Sắp xếp giảm dần theo rerankScore
  rankedLessons.sort((a, b) => b.rerankScore - a.rerankScore);

  return rankedLessons.slice(0, topK);
}

module.exports = {
  CONFIDENCE_THRESHOLD,
  searchPostgreSQLLexical,
  mergeGroupAndRerank
};
