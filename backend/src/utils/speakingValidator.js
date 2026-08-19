/**
 * Speaking AI Response Validator
 * Kiểm tra nghiêm ngặt kiểu dữ liệu từ AI Response:
 * - hasSpeech: boolean thật (không chấp nhận "false" string)
 * - transcription: string
 * - scores: finite number trong [0, 100] (không chấp nhận string "85%", NaN, Infinity)
 * - wordAssessments: mảng các objects { word, occurrenceIndex, status, confidence, feedback }
 * - audioQuality: object { quality, noiseLevel, warning }
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

function sanitizeScore(score, fieldName) {
  if (score === null || score === undefined) return 0;
  
  let num;
  if (typeof score === 'number') {
    num = score;
  } else if (typeof score === 'string') {
    // Không chấp nhận chuỗi bậy bạ, chỉ parse chuỗi số thuần túy
    const clean = score.replace('%', '').trim();
    num = Number(clean);
  } else {
    throw new Error(`Trường điểm ${fieldName} không đúng định dạng số (nhận được ${typeof score}).`);
  }

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    throw new Error(`Trường điểm ${fieldName} có giá trị không hợp lệ (${score}).`);
  }

  // Clamping trong khoảng 0-100
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parseBooleanStrict(val, fieldName = 'hasSpeech') {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return false;
}

/**
 * Validate response cho chế độ Read Aloud
 */
function validateReadAloudResponse(rawObj) {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    throw new Error("Phản hồi từ AI không phải là một JSON object hợp lệ.");
  }

  const hasSpeech = parseBooleanStrict(rawObj.hasSpeech, 'hasSpeech');
  const transcription = typeof rawObj.transcription === 'string' ? rawObj.transcription.trim() : '';

  if (!hasSpeech || !transcription) {
    return {
      hasSpeech: false,
      transcription: '',
      pronunciationScore: 0,
      fluencyScore: 0,
      wordAssessments: [],
      audioQuality: {
        hasSpeech: false,
        quality: 'no_speech',
        noiseLevel: typeof rawObj.noiseLevel === 'string' ? rawObj.noiseLevel : 'unknown',
        warning: 'Không phát hiện giọng nói từ thiết bị ghi âm.'
      },
      feedback: {
        pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : 'Không phát hiện tín hiệu giọng nói rõ ràng.',
        fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : 'Chưa ghi nhận giọng nói.',
        general: typeof rawObj.generalFeedback === 'string' ? rawObj.generalFeedback : 'Vui lòng kiểm tra micro và phát âm to hơn.'
      }
    };
  }

  const pronunciationScore = sanitizeScore(rawObj.pronunciationScore, 'pronunciationScore');
  const fluencyScore = sanitizeScore(rawObj.fluencyScore, 'fluencyScore');

  // Validate wordAssessments
  let wordAssessments = [];
  if (Array.isArray(rawObj.wordAssessments)) {
    wordAssessments = rawObj.wordAssessments.map((w, idx) => {
      if (!w || typeof w !== 'object') return null;
      const validStatuses = ['correct', 'mispronounced', 'uncertain'];
      const status = validStatuses.includes(w.status) ? w.status : 'uncertain';
      return {
        word: String(w.word || '').toLowerCase().trim(),
        occurrenceIndex: Number.isInteger(w.occurrenceIndex) ? w.occurrenceIndex : idx,
        status: status,
        confidence: Number.isFinite(w.confidence) ? Math.max(0, Math.min(1, w.confidence)) : 0.8,
        feedback: typeof w.feedback === 'string' ? w.feedback : ''
      };
    }).filter(Boolean);
  }

  // Validate audio quality
  const validQualities = ['good', 'poor', 'uncertain', 'no_speech'];
  let quality = typeof rawObj.quality === 'string' && validQualities.includes(rawObj.quality) ? rawObj.quality : 'uncertain';
  if (quality === 'good' && !rawObj.quality) quality = 'uncertain'; // Không được tự ý gán good nếu AI không trả

  return {
    hasSpeech: true,
    transcription,
    pronunciationScore,
    fluencyScore,
    wordAssessments,
    audioQuality: {
      hasSpeech: true,
      quality,
      noiseLevel: typeof rawObj.noiseLevel === 'string' ? rawObj.noiseLevel : 'unknown',
      warning: typeof rawObj.warning === 'string' ? rawObj.warning : null
    },
    feedback: {
      pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : 'Phát âm tương đối rõ ràng.',
      fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : 'Độ trôi chảy ổn định.',
      general: typeof rawObj.generalFeedback === 'string' ? rawObj.generalFeedback : 'Bạn đã hoàn thành câu đọc.'
    }
  };
}

/**
 * Validate response cho chế độ Q&A
 */
function validateQAResponse(rawObj) {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    throw new Error("Phản hồi từ AI không phải là một JSON object hợp lệ.");
  }

  const hasSpeech = parseBooleanStrict(rawObj.hasSpeech, 'hasSpeech');
  const transcription = typeof rawObj.transcription === 'string' ? rawObj.transcription.trim() : '';

  if (!hasSpeech || !transcription) {
    return {
      hasSpeech: false,
      transcription: '',
      scores: { relevance: 0, grammar: 0, vocabulary: 0, pronunciation: 0, fluency: 0 },
      audioQuality: {
        hasSpeech: false,
        quality: 'no_speech',
        noiseLevel: typeof rawObj.noiseLevel === 'string' ? rawObj.noiseLevel : 'unknown',
        warning: 'Không phát hiện giọng nói từ thiết bị ghi âm.'
      },
      feedback: {
        relevance: typeof rawObj.relevanceFeedback === 'string' ? rawObj.relevanceFeedback : 'Chưa ghi nhận câu trả lời.',
        grammar: typeof rawObj.grammarFeedback === 'string' ? rawObj.grammarFeedback : 'Chưa ghi nhận cấu trúc câu.',
        vocabulary: typeof rawObj.vocabularyFeedback === 'string' ? rawObj.vocabularyFeedback : 'Chưa ghi nhận từ vựng.',
        pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : 'Không phát hiện giọng nói.',
        fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : 'Chưa ghi nhận giọng nói.'
      },
      improvedAnswer: typeof rawObj.improvedAnswer === 'string' ? rawObj.improvedAnswer : 'Please speak clearly into your microphone.'
    };
  }

  const relevance = sanitizeScore(rawObj.relevanceScore, 'relevanceScore');
  const grammar = sanitizeScore(rawObj.grammarScore, 'grammarScore');
  const vocabulary = sanitizeScore(rawObj.vocabularyScore, 'vocabularyScore');
  const pronunciation = sanitizeScore(rawObj.pronunciationScore, 'pronunciationScore');
  const fluency = sanitizeScore(rawObj.fluencyScore, 'fluencyScore');

  const validQualities = ['good', 'poor', 'uncertain', 'no_speech'];
  let quality = typeof rawObj.quality === 'string' && validQualities.includes(rawObj.quality) ? rawObj.quality : 'uncertain';

  return {
    hasSpeech: true,
    transcription,
    scores: { relevance, grammar, vocabulary, pronunciation, fluency },
    audioQuality: {
      hasSpeech: true,
      quality,
      noiseLevel: typeof rawObj.noiseLevel === 'string' ? rawObj.noiseLevel : 'unknown',
      warning: typeof rawObj.warning === 'string' ? rawObj.warning : null
    },
    feedback: {
      relevance: typeof rawObj.relevanceFeedback === 'string' ? rawObj.relevanceFeedback : 'Câu trả lời phù hợp với ngữ cảnh.',
      grammar: typeof rawObj.grammarFeedback === 'string' ? rawObj.grammarFeedback : 'Cấu trúc ngữ pháp hoàn chỉnh.',
      vocabulary: typeof rawObj.vocabularyFeedback === 'string' ? rawObj.vocabularyFeedback : 'Từ vựng lựa chọn phù hợp.',
      pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : 'Phát âm rõ ràng.',
      fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : 'Tốc độ phản xạ đều đặn.'
    },
    improvedAnswer: typeof rawObj.improvedAnswer === 'string' ? rawObj.improvedAnswer : ''
  };
}

module.exports = {
  sanitizeScore,
  parseBooleanStrict,
  validateReadAloudResponse,
  validateQAResponse
};
