/**
 * Speaking Assessment Scorer & Token Alignment Engine (Hotfix-R2 Version)
 * - Xử lý Contractions hai chiều và giữ nguyên cấu trúc từ (không tách don't thành don và t).
 * - Thuật toán Token Alignment (Dynamic Programming / Levenshtein Distance / WER).
 * - Đếm occurrenceIndex cho MỌI lần xuất hiện của từ mục tiêu (correct, missing, substituted)
 * - Tuyệt đối không suy đoán correct khi thiếu bằng chứng âm học (mặc định not_assessed).
 *
 * === RUBRIC CHẤM ĐIỂM DỰA THEO CHUẨN QUỐC TẾ ===
 *
 * [Read Aloud] — Theo chuẩn PTE Academic (Pearson)
 *   Nguồn: PTE Academic Score Guide — pearsonpte.com
 *   3 tiêu chí cân bằng nhau (mỗi tiêu chí ~1/3):
 *     Overall = (Content + OralFluency + Pronunciation) / 3
 *
 * [Q&A Speaking] — Theo chuẩn IELTS Speaking Band Descriptors
 *   Nguồn: IELTS Official Public Band Descriptors — ielts.org
 *   4 tiêu chí cân bằng nhau (mỗi tiêu chí 25%):
 *     Overall = FluentCoherence×0.25 + LexicalResource×0.25 + GrammaticalRange×0.25 + Pronunciation×0.25
 *   Cơ chế Relevance Gate (thay thế Score Cap tự chế):
 *     Tham khảo: TOEFL iBT Speaking Scoring Rubrics (ETS) — off-topic response = 0
 *     relevanceGate < 30  → overallScore = 0 (lạc đề hoàn toàn)
 *     30 ≤ relevanceGate < 60 → cảnh báo, không giảm điểm
 *     relevanceGate ≥ 60  → chấm điểm bình thường
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai và kiểm thử mã nguồn: AI Agent
 */

// Bảng ánh xạ Contractions tiếng Anh thông dụng
const CONTRACTIONS_MAP = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "couldn't": "could not",
  "won't": "will not",
  "wouldn't": "would not",
  "shouldn't": "should not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "let's": "let us"
};

/**
 * Chuẩn hóa văn bản loại bỏ dấu câu, chữ hoa, khoảng trắng thừa và chuẩn hóa contractions
 * @param {string} text - Văn bản đầu vào
 * @param {boolean} expandContractions - Có mở rộng contractions hay không
 * @returns {string[]} Mảng các tokens chuẩn hóa
 */
function normalizeAndTokenize(text, expandContractions = false) {
  if (!text || typeof text !== 'string') return [];

  let normalized = text.toLowerCase().trim();

  // Chuẩn hóa dấu nháy đơn Unicode (curly quotes) về ASCII apostrophe
  normalized = normalized.replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'");

  if (expandContractions) {
    for (const [contraction, expansion] of Object.entries(CONTRACTIONS_MAP)) {
      const regex = new RegExp(`\\b${contraction.replace("'", "['’]?")}\\b`, 'gi');
      normalized = normalized.replace(regex, expansion);
    }
  }

  // Loại bỏ các dấu câu thông thường nhưng giữ nguyên từ vựng
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"\[\]<>@|\\]/g, " ");

  // Tách từ theo khoảng trắng
  const rawTokens = normalized.split(/\s+/).filter(t => t.length > 0);

  // Clean tokens (bỏ dấu nháy lẻ nếu nằm ở đầu hoặc cuối từ)
  return rawTokens.map(t => t.replace(/^'+|'+$/g, '')).filter(t => t.length > 0);
}

/**
 * Tính toán khoảng cách Levenshtein giữa 2 chuỗi ký tự
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  return dp[m][n];
}

/**
 * Kiểm tra xem 2 từ có tương đương nhau qua contraction hay không
 */
function isContractionEquivalent(w1, w2) {
  if (w1 === w2) return true;
  const exp1 = CONTRACTIONS_MAP[w1] || w1;
  const exp2 = CONTRACTIONS_MAP[w2] || w2;
  return exp1 === exp2;
}

/**
 * Tính Word Error Rate (WER) và ma trận Token Alignment giữa targetTokens và transcriptTokens
 * @param {string[]} targetTokens - Danh sách từ trong câu mẫu
 * @param {string[]} transcriptTokens - Danh sách từ trong transcript học viên đọc
 * @returns {object} { wer, substitutions, deletions, insertions, alignments }
 */
function computeTokenAlignment(targetTokens, transcriptTokens) {
  const N = targetTokens.length;
  const M = transcriptTokens.length;

  if (N === 0 && M === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, correctMatches: 0, alignments: [] };
  }
  if (N === 0) {
    return {
      wer: 1.0,
      substitutions: 0,
      deletions: 0,
      insertions: M,
      correctMatches: 0,
      alignments: transcriptTokens.map(w => ({ targetWord: null, transcriptWord: w, op: 'extra' }))
    };
  }
  if (M === 0) {
    return {
      wer: 1.0,
      substitutions: 0,
      deletions: N,
      insertions: 0,
      correctMatches: 0,
      alignments: targetTokens.map(w => ({ targetWord: w, transcriptWord: null, op: 'missing' }))
    };
  }

  // Dynamic Programming Matrix cho Word-Level Alignment
  const d = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));
  const ops = Array.from({ length: N + 1 }, () => Array(M + 1).fill(''));

  for (let i = 0; i <= N; i++) {
    d[i][0] = i;
    ops[i][0] = 'D'; // Deletion (missing)
  }
  for (let j = 0; j <= M; j++) {
    d[0][j] = j;
    ops[0][j] = 'I'; // Insertion (extra)
  }

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const tWord = targetTokens[i - 1];
      const hWord = transcriptTokens[j - 1];

      let matchCost = 0;
      if (tWord === hWord || isContractionEquivalent(tWord, hWord)) {
        matchCost = 0;
      } else {
        const lev = levenshteinDistance(tWord, hWord);
        matchCost = (lev <= 1 && Math.max(tWord.length, hWord.length) >= 4) ? 0.75 : 1.0;
      }

      const costSub = d[i - 1][j - 1] + matchCost;
      const costDel = d[i - 1][j] + 1; // missing from target
      const costIns = d[i][j - 1] + 1; // extra in transcript

      const minCost = Math.min(costSub, costDel, costIns);
      d[i][j] = minCost;

      if (minCost === costSub) {
        ops[i][j] = matchCost === 0 ? 'M' : 'S'; // Match or Substituted
      } else if (minCost === costDel) {
        ops[i][j] = 'D';
      } else {
        ops[i][j] = 'I';
      }
    }
  }

  // Backtracking tìm Alignment Path
  let i = N;
  let j = M;
  const path = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && (ops[i][j] === 'M' || ops[i][j] === 'S')) {
      path.push({
        targetWord: targetTokens[i - 1],
        transcriptWord: transcriptTokens[j - 1],
        op: ops[i][j] === 'M' ? 'correct_text' : 'substituted'
      });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || ops[i][j] === 'D')) {
      path.push({
        targetWord: targetTokens[i - 1],
        transcriptWord: null,
        op: 'missing'
      });
      i--;
    } else {
      path.push({
        targetWord: null,
        transcriptWord: transcriptTokens[j - 1],
        op: 'extra'
      });
      j--;
    }
  }

  path.reverse();

  let deletions = 0;
  let insertions = 0;
  let substitutions = 0;
  let correctMatches = 0;

  for (const item of path) {
    if (item.op === 'correct_text') correctMatches++;
    else if (item.op === 'missing') deletions++;
    else if (item.op === 'extra') insertions++;
    else if (item.op === 'substituted') substitutions++;
  }

  // WER = (S + D + I) / N
  const wer = (substitutions + deletions + insertions) / N;

  return {
    wer,
    substitutions,
    deletions,
    insertions,
    correctMatches,
    alignments: path
  };
}

/**
 * Phân loại trạng thái từng từ theo Schema phân tách (textMatch & acousticStatus)
 * - Tăng occurrenceIndex cho MỌI lần xuất hiện của từ trong câu mục tiêu (correct, missing, substituted)
 * - Tuyệt đối không suy đoán phát âm đúng khi thiếu bằng chứng
 * @param {string} targetText - Câu mẫu gốc
 * @param {string} transcription - Transcript nhận diện từ audio
 * @param {Array} wordAssessments - Danh sách đánh giá âm học từ AI [{ word, occurrenceIndex, status, feedback }]
 * @returns {Array} Danh sách word items
 */
function buildWordLevelFeedback(targetText, transcription, wordAssessments = []) {
  if (!targetText || typeof targetText !== 'string') return [];

  const targetTokens = normalizeAndTokenize(targetText, false);
  const transcriptTokens = normalizeAndTokenize(transcription, false);

  const { alignments } = computeTokenAlignment(targetTokens, transcriptTokens);

  // Tạo map tra cứu theo `${word}#${occurrenceIndex}`
  const aiAssessMap = new Map();
  if (Array.isArray(wordAssessments)) {
    for (const item of wordAssessments) {
      if (item && typeof item === 'object' && item.word) {
        const cleanW = String(item.word).toLowerCase().trim();
        const occIdx = Number.isInteger(item.occurrenceIndex) ? item.occurrenceIndex : 0;
        const key = `${cleanW}#${occIdx}`;
        aiAssessMap.set(key, {
          status: item.status || 'uncertain',
          feedback: item.feedback || null
        });
      }
    }
  }

  const resultWords = [];
  // Đếm occurrenceIndex cho target words
  const targetOccurrences = new Map();

  for (const align of alignments) {
    const word = align.targetWord || align.transcriptWord;
    const textMatch = align.op; // 'correct_text' | 'missing' | 'extra' | 'substituted'
    let acousticStatus = 'not_assessed';
    let feedback = null;

    let currentOcc = 0;
    if (align.targetWord) {
      const cleanTarget = align.targetWord.toLowerCase();
      currentOcc = targetOccurrences.get(cleanTarget) || 0;
      // Tăng occurrenceIndex cho MỌI lần xuất hiện của target word trong câu
      targetOccurrences.set(cleanTarget, currentOcc + 1);
    }

    if (textMatch === 'missing') {
      acousticStatus = 'not_assessed';
      feedback = 'Từ này bị bỏ sót trong câu đọc.';
    } else if (textMatch === 'extra') {
      acousticStatus = 'not_assessed';
      feedback = 'Từ này đọc thừa, không có trong câu mẫu.';
    } else if (textMatch === 'substituted') {
      acousticStatus = 'not_assessed';
      feedback = `Đọc sai/thay thế bằng từ "${align.transcriptWord}".`;
    } else if (textMatch === 'correct_text') {
      const cleanW = align.targetWord.toLowerCase();
      const assessKey = `${cleanW}#${currentOcc}`;

      if (aiAssessMap.has(assessKey)) {
        const aiInfo = aiAssessMap.get(assessKey);
        if (aiInfo.status === 'correct') {
          acousticStatus = 'correct';
          feedback = aiInfo.feedback || 'Phát âm chuẩn xác.';
        } else if (aiInfo.status === 'mispronounced') {
          acousticStatus = 'mispronounced';
          feedback = aiInfo.feedback || 'Phát âm chưa chuẩn âm vị hoặc trọng âm.';
        } else {
          acousticStatus = 'uncertain';
          feedback = aiInfo.feedback || 'Chưa đủ dữ liệu âm học rõ ràng.';
        }
      } else {
        // Bắt buộc: Không có bằng chứng âm học thì là not_assessed, KHÔNG được mặc định correct
        acousticStatus = 'not_assessed';
        feedback = 'Chưa đủ dữ liệu âm học để đánh giá âm vị từng từ.';
      }
    }

    resultWords.push({
      word: word,
      textMatch: textMatch,
      acousticStatus: acousticStatus,
      feedback: feedback
    });
  }

  return resultWords;
}

/**
 * Tính toán điểm Read Aloud theo chuẩn PTE Academic (Pearson).
 *
 * Nguồn: PTE Academic Score Guide — pearsonpte.com
 * PTE Academic đánh giá Read Aloud theo 3 tiêu chí cân bằng nhau:
 *   - Content    (~1/3): Độ chính xác nội dung đọc so với câu mẫu (tính từ WER)
 *   - Oral Fluency (~1/3): Sự trôi chảy, nhịp điệu, không ngắt quãng bất thường
 *   - Pronunciation (~1/3): Phát âm chuẩn xác âm vị, trọng âm
 *
 * Công thức: Overall = round((Content + OralFluency + Pronunciation) / 3)
 *
 * Lưu ý: "Completeness" (đọc đủ từ) được tích hợp tự nhiên vào Content
 * thông qua WER (từ bị bỏ sót = Deletion → làm tăng WER → giảm Content score).
 */
function calculateReadAloudScore({ targetText, transcription, pronunciationScore = 0, fluencyScore = 0, wordAssessments = [] }) {
  const targetTokensExpanded = normalizeAndTokenize(targetText, true);
  const transcriptTokensExpanded = normalizeAndTokenize(transcription, true);

  if (targetTokensExpanded.length === 0) {
    return {
      overallScore: 0,
      components: { pronunciation: 0, contentAccuracy: 0, fluency: 0, completeness: 0 },
      words: []
    };
  }

  if (transcriptTokensExpanded.length === 0) {
    const rawTokens = normalizeAndTokenize(targetText, false);
    const emptyWords = rawTokens.map(w => ({
      word: w,
      textMatch: 'missing',
      acousticStatus: 'not_assessed',
      feedback: 'Không nghe thấy từ này.'
    }));
    return {
      overallScore: 0,
      components: {
        pronunciation: 0,
        contentAccuracy: 0,
        fluency: 0,
        completeness: 0
      },
      words: emptyWords
    };
  }

  const { wer, correctMatches } = computeTokenAlignment(targetTokensExpanded, transcriptTokensExpanded);

  // Content Score = (1 - WER) × 100, clamped [0, 100]
  // Tích hợp cả Completeness: từ bị bỏ sót (Deletion) đã phản ánh trong WER
  const contentAccuracy = Math.max(0, Math.min(100, Math.round((1 - Math.min(wer, 1.0)) * 100)));

  // Completeness vẫn được tính để hiển thị UI, nhưng KHÔNG dùng làm trọng số riêng
  const completeness = Math.max(0, Math.min(100, Math.round((correctMatches / targetTokensExpanded.length) * 100)));

  const pScore = Math.max(0, Math.min(100, Number(pronunciationScore) || 0));
  const fScore = Math.max(0, Math.min(100, Number(fluencyScore) || 0));

  // === PTE Academic Formula: 3 tiêu chí cân bằng nhau (~1/3 mỗi tiêu chí) ===
  // Nguồn: PTE Academic Score Guide — pearsonpte.com
  const rawOverall = (contentAccuracy + fScore + pScore) / 3;
  const overallScore = Math.max(0, Math.min(100, Math.round(rawOverall)));

  const words = buildWordLevelFeedback(targetText, transcription, wordAssessments);

  return {
    overallScore,
    components: {
      pronunciation: pScore,
      contentAccuracy: contentAccuracy,
      fluency: fScore,
      completeness: completeness
    },
    words
  };
}

/**
 * Tính toán điểm Q&A Speaking theo chuẩn IELTS Speaking Band Descriptors.
 *
 * Nguồn: IELTS Official Public Band Descriptors — ielts.org
 * IELTS Speaking đánh giá theo 4 tiêu chí cân bằng nhau (25% mỗi tiêu chí):
 *   - Fluency & Coherence (FC)    : Sự trôi chảy, mạch lạc, liên kết ý tưởng
 *   - Lexical Resource (LR)       : Vốn từ vựng, sự đa dạng và chính xác
 *   - Grammatical Range & Accuracy: Cấu trúc ngữ pháp đa dạng và chính xác
 *   - Pronunciation (PR)          : Phát âm, trọng âm, ngữ điệu
 *
 * Công thức IELTS:
 *   Overall = (FC + LR + GRA + PR) / 4
 *
 * Cơ chế Relevance Gate (bổ sung cho bối cảnh E-learning không có giám khảo):
 *   Tham khảo: TOEFL iBT Speaking Scoring Rubrics (ETS) — off-topic response = score 0
 *   - relevanceGate < 30  → overallScore = 0 (lạc đề hoàn toàn, không chấm)
 *   - 30 ≤ relevanceGate < 60 → chấm bình thường, hiển thị cảnh báo
 *   - relevanceGate ≥ 60  → chấm bình thường
 *
 * Lưu ý tên tham số theo IELTS chính thức:
 *   fluencyCoherence = Fluency & Coherence (FC)
 *   lexicalResource  = Lexical Resource (LR)
 *   grammaticalRange = Grammatical Range & Accuracy (GRA)
 *   pronunciation    = Pronunciation (PR)
 *   relevanceGate    = Không phải tiêu chí IELTS, chỉ dùng để phát hiện lạc đề
 */
function calculateQAScore({
  relevanceGate,
  fluencyCoherence,
  lexicalResource,
  grammaticalRange,
  pronunciation = 0,
  // Backward-compat aliases (tên cũ)
  relevance,
  fluency,
  vocabulary,
  grammar
} = {}) {
  // Hỗ trợ tên cũ nếu tên mới không được truyền vào (undefined).
  // KHÔNG dùng ?? vì default 0 sẽ khiến ?? luôn chọn tên mới dù không được truyền.
  const gateScore = Math.max(0, Math.min(100, Number(relevanceGate !== undefined ? relevanceGate : (relevance ?? 0)) || 0));
  const fc        = Math.max(0, Math.min(100, Number(fluencyCoherence !== undefined ? fluencyCoherence : (fluency ?? 0)) || 0));
  const lr        = Math.max(0, Math.min(100, Number(lexicalResource !== undefined ? lexicalResource : (vocabulary ?? 0)) || 0));
  const gra       = Math.max(0, Math.min(100, Number(grammaticalRange !== undefined ? grammaticalRange : (grammar ?? 0)) || 0));
  const pr        = Math.max(0, Math.min(100, Number(pronunciation) || 0));

  // === IELTS Formula: 4 tiêu chí cân bằng nhau (25% mỗi tiêu chí) ===
  // Nguồn: IELTS Official Band Descriptors — ielts.org
  const rawScore = (fc * 0.25) + (lr * 0.25) + (gra * 0.25) + (pr * 0.25);
  let overallScore = Math.round(rawScore);

  // === Relevance Gate (TOEFL iBT-inspired) ===
  // TOEFL iBT: "Off-Topic responses receive a score of 0" — ETS TOEFL iBT Speaking Scoring Rubrics
  let relevanceWarning = null;
  let offTopic = false;

  if (gateScore < 30) {
    // Lạc đề hoàn toàn → không chấm điểm
    overallScore = 0;
    offTopic = true;
    relevanceWarning = "Câu trả lời hoàn toàn lạc đề so với câu hỏi (Relevance Gate < 30). Điểm = 0. [Tham chiếu: TOEFL iBT Speaking Scoring Rubrics — ETS]";
  } else if (gateScore < 60) {
    // Chưa đúng trọng tâm → cảnh báo, không giảm điểm
    relevanceWarning = "Câu trả lời chưa đúng trọng tâm câu hỏi (Relevance Gate < 60). Hãy bám sát chủ đề hơn.";
  }

  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore,
    components: {
      fluencyCoherence: fc,
      lexicalResource: lr,
      grammaticalRange: gra,
      pronunciation: pr,
      relevanceGate: gateScore
    },
    offTopic,
    relevanceWarning,
    // Backward-compat: giữ lại trường cũ để không break controller
    scoreCapApplied: offTopic,
    scoreCapReason: relevanceWarning
  };
}

module.exports = {
  CONTRACTIONS_MAP,
  normalizeAndTokenize,
  levenshteinDistance,
  isContractionEquivalent,
  computeTokenAlignment,
  buildWordLevelFeedback,
  calculateReadAloudScore,
  calculateQAScore
};
