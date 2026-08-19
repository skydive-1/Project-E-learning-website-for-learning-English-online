/**
 * Speaking Assessment Scorer & Token Alignment Engine (Hotfix Version)
 * - Chuẩn hóa văn bản, xử lý Contractions hai chiều, dấu câu, chữ hoa/thường.
 * - Thuật toán Token Alignment (Dynamic Programming / Levenshtein Distance / WER).
 * - Phân loại trạng thái từng từ theo schema phân tách (textMatch & acousticStatus).
 * - Xử lý wordAssessments với occurrenceIndex, tuyệt đối không suy đoán correct khi không có bằng chứng.
 * - Tính toán điểm số Read Aloud và Q&A Speaking theo rubric và cơ chế Score Cap.
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
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
      const regex = new RegExp(`\\b${contraction.replace("'", "['’]")}\\b`, 'gi');
      normalized = normalized.replace(regex, expansion);
    }
  }

  // Loại bỏ toàn bộ dấu câu ngoại trừ ký tự chữ và số
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\[\]<>@|\\]/g, " ");

  // Tách từ theo khoảng trắng
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  return tokens;
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
      if (tWord === hWord) {
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
 * Xử lý occurrenceIndex và không suy đoán phát âm đúng khi thiếu bằng chứng
 * @param {string} targetText - Câu mẫu gốc
 * @param {string} transcription - Transcript nhận diện từ audio
 * @param {Array} wordAssessments - Danh sách đánh giá âm học từ AI [{ word, occurrenceIndex, status, feedback }]
 * @returns {Array} Danh sách word items
 */
function buildWordLevelFeedback(targetText, transcription, wordAssessments = []) {
  if (!targetText || typeof targetText !== 'string') return [];

  // Để hiển thị đẹp và khớp token, thực hiện alignment trên tokens chuẩn hóa (không expand cho visual alignment)
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
  const wordOccurrences = new Map();

  for (const align of alignments) {
    const word = align.targetWord || align.transcriptWord;
    const textMatch = align.op; // 'correct_text' | 'missing' | 'extra' | 'substituted'
    let acousticStatus = 'not_assessed';
    let feedback = null;

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
      const currentOcc = wordOccurrences.get(cleanW) || 0;
      wordOccurrences.set(cleanW, currentOcc + 1);

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
 * Tính toán điểm Read Aloud theo công thức chuẩn:
 * Overall = Pronunciation * 0.35 + ContentAccuracy * 0.30 + Fluency * 0.20 + Completeness * 0.15
 * Áp dụng Contraction Normalization hai chiều cho cả targetText và transcription
 */
function calculateReadAloudScore({ targetText, transcription, pronunciationScore = 0, fluencyScore = 0, wordAssessments = [] }) {
  // Áp dụng Contraction Expansion khi tính WER / Accuracy / Completeness
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

  // Clamping contentAccuracy trong khoảng [0, 100]
  const contentAccuracy = Math.max(0, Math.min(100, Math.round((1 - Math.min(wer, 1.0)) * 100)));

  // Completeness = matched / total
  const completeness = Math.max(0, Math.min(100, Math.round((correctMatches / targetTokensExpanded.length) * 100)));

  const pScore = Math.max(0, Math.min(100, Number(pronunciationScore) || 0));
  const fScore = Math.max(0, Math.min(100, Number(fluencyScore) || 0));

  // Công thức trọng số Read Aloud
  const rawOverall = (pScore * 0.35) + (contentAccuracy * 0.30) + (fScore * 0.20) + (completeness * 0.15);
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
 * Tính toán điểm Q&A Speaking theo rubric và cơ chế Score Cap:
 * RawScore = Relevance * 0.20 + Grammar * 0.20 + Vocabulary * 0.15 + Pronunciation * 0.25 + Fluency * 0.20
 * Score Cap:
 * - relevance < 20 => overallScore <= 49 (Fail)
 * - 20 <= relevance < 40 => overallScore <= 59 (Weak)
 */
function calculateQAScore({ relevance = 0, grammar = 0, vocabulary = 0, pronunciation = 0, fluency = 0 }) {
  const r = Math.max(0, Math.min(100, Number(relevance) || 0));
  const g = Math.max(0, Math.min(100, Number(grammar) || 0));
  const v = Math.max(0, Math.min(100, Number(vocabulary) || 0));
  const p = Math.max(0, Math.min(100, Number(pronunciation) || 0));
  const f = Math.max(0, Math.min(100, Number(fluency) || 0));

  const rawScore = (r * 0.20) + (g * 0.20) + (v * 0.15) + (p * 0.25) + (f * 0.20);
  let overallScore = Math.round(rawScore);

  let scoreCapApplied = false;
  let scoreCapReason = null;

  // Áp dụng Score Cap khi câu trả lời lạc đề
  if (r < 20) {
    if (overallScore > 49) {
      overallScore = 49;
      scoreCapApplied = true;
      scoreCapReason = "Câu trả lời hoàn toàn lạc đề so với câu hỏi (Relevance < 20%), điểm tổng bị giới hạn trần tối đa 49 điểm.";
    }
  } else if (r < 40) {
    if (overallScore > 59) {
      overallScore = 59;
      scoreCapApplied = true;
      scoreCapReason = "Câu trả lời chưa đúng trọng tâm câu hỏi (Relevance < 40%), điểm tổng bị giới hạn trần tối đa 59 điểm.";
    }
  }

  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore,
    components: {
      relevance: r,
      grammar: g,
      vocabulary: v,
      pronunciation: p,
      fluency: f
    },
    scoreCapApplied,
    scoreCapReason
  };
}

module.exports = {
  CONTRACTIONS_MAP,
  normalizeAndTokenize,
  levenshteinDistance,
  computeTokenAlignment,
  buildWordLevelFeedback,
  calculateReadAloudScore,
  calculateQAScore
};
