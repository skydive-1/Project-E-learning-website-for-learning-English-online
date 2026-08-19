/**
 * Strict Speaking AI Response Validator (TASK-AI-SPEAKING-01-HOTFIX-R2)
 *
 * Kiểm tra nghiêm ngặt kiểu dữ liệu từ AI Response:
 * - hasSpeech: boolean thật (BẮT BUỘC typeof === 'boolean', từ chối "true", "false")
 * - scores: finite number trong [0, 100] (từ chối "85", "85%", NaN, Infinity, <0, >100 - KHÔNG auto-clamp)
 * - Khi hasSpeech === true: tất cả điểm bắt buộc phải tồn tại, KHÔNG mặc định thành 0
 * - wordAssessments: status thuộc ['correct', 'mispronounced', 'uncertain']
 * - KHÔNG tự động tạo feedback tích cực giả mạo
 * - Ném lỗi chuẩn AI_RESPONSE_INVALID (HTTP 503) khi schema sai
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai và kiểm thử mã nguồn: AI Agent
 */

function createValidationError(message) {
  const err = new Error(message);
  err.status = 503;
  err.code = 'AI_RESPONSE_INVALID';
  return err;
}

/**
 * Validate một trường điểm số nghiêm ngặt
 */
function validateStrictScore(score, fieldName) {
  if (score === null || score === undefined) {
    throw createValidationError(`Thiếu trường điểm bắt buộc: ${fieldName}`);
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score)) {
    throw createValidationError(`Trường điểm ${fieldName} phải là một số hợp lệ (nhận được ${typeof score}: ${score}).`);
  }

  if (score < 0 || score > 100) {
    throw createValidationError(`Trường điểm ${fieldName} (${score}) nằm ngoài thang điểm hợp lệ 0-100.`);
  }

  return Math.round(score);
}

/**
 * Validate trường boolean nghiêm ngặt
 */
function validateStrictBoolean(val, fieldName = 'hasSpeech') {
  if (typeof val !== 'boolean') {
    throw createValidationError(`Trường ${fieldName} phải là boolean (true/false), không chấp nhận chuỗi hoặc kiểu khác (nhận được ${typeof val}: ${val}).`);
  }
  return val;
}

/**
 * Validate response cho chế độ Read Aloud
 */
function validateReadAloudResponse(rawObj) {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    throw createValidationError("Phản hồi từ AI không phải là một JSON object hợp lệ.");
  }

  const hasSpeech = validateStrictBoolean(rawObj.hasSpeech, 'hasSpeech');

  if (!hasSpeech) {
    return {
      hasSpeech: false,
      transcription: typeof rawObj.transcription === 'string' ? rawObj.transcription.trim() : '',
      pronunciationScore: 0,
      fluencyScore: 0,
      wordAssessments: [],
      audioQuality: {
        hasSpeech: false,
        quality: 'no_speech',
        noiseLevel: typeof rawObj.noiseLevel === 'string' ? rawObj.noiseLevel : 'unknown',
        warning: typeof rawObj.warning === 'string' ? rawObj.warning : 'Không phát hiện giọng nói từ thiết bị ghi âm.'
      },
      feedback: {
        pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : null,
        fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : null,
        general: typeof rawObj.generalFeedback === 'string' ? rawObj.generalFeedback : null
      }
    };
  }

  // Khi hasSpeech === true, transcription và các điểm bắt buộc phải có
  if (typeof rawObj.transcription !== 'string' || !rawObj.transcription.trim()) {
    throw createValidationError("Khi hasSpeech là true, trường transcription không được để trống.");
  }

  const transcription = rawObj.transcription.trim();
  const pronunciationScore = validateStrictScore(rawObj.pronunciationScore, 'pronunciationScore');
  const fluencyScore = validateStrictScore(rawObj.fluencyScore, 'fluencyScore');

  // Validate wordAssessments
  let wordAssessments = [];
  if (rawObj.wordAssessments !== undefined && rawObj.wordAssessments !== null) {
    if (!Array.isArray(rawObj.wordAssessments)) {
      throw createValidationError("Trường wordAssessments phải là một mảng nếu được cung cấp.");
    }
    wordAssessments = rawObj.wordAssessments.map((w, idx) => {
      if (!w || typeof w !== 'object') {
        throw createValidationError(`Mục wordAssessments thứ ${idx} không hợp lệ.`);
      }
      const validStatuses = ['correct', 'mispronounced', 'uncertain'];
      if (!validStatuses.includes(w.status)) {
        throw createValidationError(`Trạng thái status '${w.status}' trong wordAssessments không hợp lệ.`);
      }
      return {
        word: String(w.word || '').toLowerCase().trim(),
        occurrenceIndex: Number.isInteger(w.occurrenceIndex) ? w.occurrenceIndex : idx,
        status: w.status,
        confidence: typeof w.confidence === 'number' && Number.isFinite(w.confidence) ? w.confidence : null,
        feedback: typeof w.feedback === 'string' ? w.feedback : ''
      };
    });
  }

  // Validate audio quality
  const validQualities = ['good', 'poor', 'uncertain', 'no_speech'];
  const quality = typeof rawObj.quality === 'string' && validQualities.includes(rawObj.quality) ? rawObj.quality : 'uncertain';

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
      pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : null,
      fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : null,
      general: typeof rawObj.generalFeedback === 'string' ? rawObj.generalFeedback : null
    }
  };
}

/**
 * Validate response cho chế độ Q&A
 */
function validateQAResponse(rawObj) {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    throw createValidationError("Phản hồi từ AI không phải là một JSON object hợp lệ.");
  }

  const hasSpeech = validateStrictBoolean(rawObj.hasSpeech, 'hasSpeech');

  if (!hasSpeech) {
    return {
      hasSpeech: false,
      transcription: typeof rawObj.transcription === 'string' ? rawObj.transcription.trim() : '',
      scores: { relevance: 0, grammar: 0, vocabulary: 0, pronunciation: 0, fluency: 0 },
      audioQuality: {
        hasSpeech: false,
        quality: 'no_speech',
        noiseLevel: typeof rawObj.noiseLevel === 'string' ? rawObj.noiseLevel : 'unknown',
        warning: typeof rawObj.warning === 'string' ? rawObj.warning : 'Không phát hiện giọng nói.'
      },
      feedback: {
        relevance: typeof rawObj.relevanceFeedback === 'string' ? rawObj.relevanceFeedback : null,
        grammar: typeof rawObj.grammarFeedback === 'string' ? rawObj.grammarFeedback : null,
        vocabulary: typeof rawObj.vocabularyFeedback === 'string' ? rawObj.vocabularyFeedback : null,
        pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : null,
        fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : null
      },
      improvedAnswer: typeof rawObj.improvedAnswer === 'string' ? rawObj.improvedAnswer : ''
    };
  }

  if (typeof rawObj.transcription !== 'string' || !rawObj.transcription.trim()) {
    throw createValidationError("Khi hasSpeech là true, trường transcription không được để trống.");
  }

  const transcription = rawObj.transcription.trim();
  const relevance = validateStrictScore(rawObj.relevanceScore, 'relevanceScore');
  const grammar = validateStrictScore(rawObj.grammarScore, 'grammarScore');
  const vocabulary = validateStrictScore(rawObj.vocabularyScore, 'vocabularyScore');
  const pronunciation = validateStrictScore(rawObj.pronunciationScore, 'pronunciationScore');
  const fluency = validateStrictScore(rawObj.fluencyScore, 'fluencyScore');

  const validQualities = ['good', 'poor', 'uncertain', 'no_speech'];
  const quality = typeof rawObj.quality === 'string' && validQualities.includes(rawObj.quality) ? rawObj.quality : 'uncertain';

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
      relevance: typeof rawObj.relevanceFeedback === 'string' ? rawObj.relevanceFeedback : null,
      grammar: typeof rawObj.grammarFeedback === 'string' ? rawObj.grammarFeedback : null,
      vocabulary: typeof rawObj.vocabularyFeedback === 'string' ? rawObj.vocabularyFeedback : null,
      pronunciation: typeof rawObj.pronunciationFeedback === 'string' ? rawObj.pronunciationFeedback : null,
      fluency: typeof rawObj.fluencyFeedback === 'string' ? rawObj.fluencyFeedback : null
    },
    improvedAnswer: typeof rawObj.improvedAnswer === 'string' ? rawObj.improvedAnswer : ''
  };
}

module.exports = {
  createValidationError,
  validateStrictScore,
  validateStrictBoolean,
  validateReadAloudResponse,
  validateQAResponse
};
