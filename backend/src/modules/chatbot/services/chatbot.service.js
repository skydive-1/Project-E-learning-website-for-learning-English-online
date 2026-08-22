const { geminiModel, geminiSpeakingModel, getSpeakingModelName, embeddingModel, pineconeIndex } = require("../../../utils/ai-clients");
const speakingScorer = require("../../../utils/speakingScorer");
const speakingValidator = require("../../../utils/speakingValidator");
const db = require("../../../config/database");
const { execFile } = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Trích xuất thời lượng audio an toàn qua FFmpeg metadata (không dùng shell: true)
 */
async function extractAudioDurationSafely(audioBuffer, ext = 'webm') {
  let tempDir = null;
  let tempFile = null;
  try {
    let ffmpegPath = null;
    try {
      const ffmpeg = require('@ffmpeg-installer/ffmpeg');
      if (ffmpeg && ffmpeg.path && fs.existsSync(ffmpeg.path)) {
        ffmpegPath = ffmpeg.path;
      }
    } catch (e) { /* ignore */ }

    if (!ffmpegPath) {
      return { duration: null, checked: false, reason: 'FFmpeg binary not available' };
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaking_aud_'));
    const safeExt = String(ext).replace(/[^a-zA-Z0-9]/g, '') || 'webm';
    tempFile = path.join(tempDir, `audio_${crypto.randomUUID()}.${safeExt}`);
    fs.writeFileSync(tempFile, audioBuffer);

    const stderrOutput = await new Promise((resolve) => {
      execFile(
        ffmpegPath,
        ['-hide_banner', '-i', tempFile],
        { timeout: 3000 },
        (error, stdout, stderr) => {
          resolve(stderr || stdout || '');
        }
      );
    });

    const match = stderrOutput.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      return { duration: totalSeconds, checked: true };
    }

    return { duration: null, checked: false, reason: 'Duration metadata not found in stream' };
  } catch (err) {
    return { duration: null, checked: false, reason: err.message };
  } finally {
    if (tempFile) {
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
    }
    if (tempDir) {
      try { if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir); } catch (e) { /* ignore */ }
    }
  }
}


// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

let hasLoggedPineconeAuthWarning = false;

function handlePineconeError(err, prefix = 'Pinecone Retrieval') {
  if (!err) return;
  const isAuthError = err.message && (err.message.includes('rejected') || err.message.includes('API key') || err.message.includes('401') || err.message.includes('Unauthorized'));
  if (isAuthError) {
    if (!hasLoggedPineconeAuthWarning) {
      console.log(`[RAG Resilient Engine] ℹ️ Pinecone API Key chưa kích hoạt hoặc hết hạn -> Tự động chuyển 100% sang PostgreSQL Full-text & Transcript Search.`);
      hasLoggedPineconeAuthWarning = true;
    }
  } else {
    console.warn(`[${prefix} Warning] ${err.message}`);
  }
}

/**
 * Xác thực quyền truy cập bài học và khóa học dựa trên PostgreSQL làm Source of Truth
 */
const verifyLessonAndCourseAccess = async (userId, lessonId) => {
  if (!lessonId || Number(lessonId) === 0) {
    return { isGlobal: true, courseId: null, lesson: null, authorized: true };
  }

  const parsedLessonId = Number(lessonId);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    const notFoundErr = new Error('Mã bài học không hợp lệ.');
    notFoundErr.status = 404;
    throw notFoundErr;
  }

  const hierarchyRes = await db.query(`
    SELECT l.lesson_id, l.title as lesson_title, s.section_id, s.title as section_title, s.course_id, c.course_name, c.price, c.instructor_id
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    WHERE l.lesson_id = $1
    LIMIT 1;
  `, [parsedLessonId]);

  if (hierarchyRes.rows.length === 0) {
    const notFoundErr = new Error('Bài học không tồn tại trên hệ thống.');
    notFoundErr.status = 404;
    throw notFoundErr;
  }

  const lessonInfo = hierarchyRes.rows[0];
  const courseId = Number(lessonInfo.course_id);
  const coursePrice = Number(lessonInfo.price || 0);
  const instructorId = Number(lessonInfo.instructor_id);

  if (userId) {
    const parsedUserId = Number(userId);
    const userRes = await db.query('SELECT user_id, role_id FROM users WHERE user_id = $1', [parsedUserId]);
    if (userRes.rows.length > 0) {
      const roleId = Number(userRes.rows[0].role_id);
      // 1. Admin (role 1) có toàn quyền
      if (roleId === 1) {
        return { isGlobal: false, courseId, lesson: lessonInfo, authorized: true };
      }
      // 2. Giảng viên sở hữu khóa học
      if (roleId === 2 && instructorId === parsedUserId) {
        return { isGlobal: false, courseId, lesson: lessonInfo, authorized: true };
      }
      // 3. Khóa học miễn phí (price = 0)
      if (coursePrice === 0) {
        return { isGlobal: false, courseId, lesson: lessonInfo, authorized: true };
      }
      // 4. Học viên đã ghi danh / thanh toán thành công
      const paymentRes = await db.query(
        "SELECT 1 FROM payments WHERE student_id = $1 AND course_id = $2 AND status = 'completed' LIMIT 1",
        [parsedUserId, courseId]
      );
      if (paymentRes.rows.length > 0) {
        return { isGlobal: false, courseId, lesson: lessonInfo, authorized: true };
      }
      // Chưa thanh toán khóa học có phí
      const forbiddenErr = new Error('Bạn chưa ghi danh khóa học này để sử dụng trợ lý học tập AI.');
      forbiddenErr.status = 403;
      throw forbiddenErr;
    }
  }

  // Khóa học miễn phí mặc định cho phép truy cập
  if (coursePrice === 0) {
    return { isGlobal: false, courseId, lesson: lessonInfo, authorized: true };
  }

  const forbiddenErr = new Error('Vui lòng đăng nhập và ghi danh khóa học để sử dụng trợ lý học tập AI.');
  forbiddenErr.status = 403;
  throw forbiddenErr;
};

/**
 * Hàm tìm kiếm ngữ cảnh thống nhất (Hỗ trợ cả Current-Lesson QA và Course-Wide Search)
 */
const retrieveContext = async (lessonId, question, mode = 'current_lesson', verifiedCourseId = null) => {
  const embeddingResult = await embeddingModel.embedContent({
    content: { parts: [{ text: question }] },
    outputDimensionality: 768
  });
  const queryVector = embeddingResult.embedding?.values;

  if (!queryVector) {
    throw new Error("Không thể tạo vector embedding từ câu hỏi.");
  }

  const queryOptions = {
    vector: queryVector,
    includeMetadata: true
  };

  const activeVersion = (process.env.ACTIVE_RAG_VERSION || 'v2').toLowerCase();
  const isV2 = activeVersion === 'v2';

  // 1. Phân giải Namespace tương ứng với phiên bản kích hoạt
  const targetNamespace = isV2
    ? (process.env.PINECONE_NAMESPACE_V2 || process.env.PINECONE_NAMESPACE || 'rag-v2')
    : (process.env.PINECONE_NAMESPACE_V1 || '');

  const targetIndex = (pineconeIndex && typeof pineconeIndex.namespace === 'function' && targetNamespace)
    ? pineconeIndex.namespace(targetNamespace)
    : pineconeIndex;

const { searchPostgreSQLLexical, mergeGroupAndRerank } = require('./hybridSearch.service');

  let matches = [];
  let rankedLessons = [];
  let contextText = "";

  if (isV2 && mode === 'course_wide' && verifiedCourseId) {
    // 2.A. V2 Hybrid Retrieval (Course-Wide): Pinecone Semantic Search (topK=8) + PostgreSQL Lexical Search + Grouping & Rerank
    queryOptions.topK = 8;
    queryOptions.filter = {
      course_id: { $eq: Number(verifiedCourseId) },
      schema_version: { $eq: 'v2' }
    };

    let vectorMatches = [];
    let lexicalMatches = [];

    // Chạy song song Semantic Vector Search và PostgreSQL Lexical Search độc lập (Resilient)
    try {
      const results = await Promise.allSettled([
        targetIndex ? targetIndex.query(queryOptions) : Promise.resolve({ matches: [] }),
        searchPostgreSQLLexical(question, Number(verifiedCourseId))
      ]);

      if (results[0].status === 'fulfilled') {
        vectorMatches = results[0].value?.matches || [];
      } else {
        handlePineconeError(results[0].reason, 'Hybrid Retrieval');
      }

      if (results[1].status === 'fulfilled') {
        lexicalMatches = results[1].value || [];
      } else {
        console.warn(`[Hybrid Retrieval Warning] PostgreSQL Lexical Search: ${results[1].reason?.message}`);
      }
    } catch (searchErr) {
      handlePineconeError(searchErr, 'Hybrid Retrieval');
    }

    // Hợp nhất, Gom nhóm theo bài học (Lesson Grouping) và Tái xếp hạng (Deterministic Reranking)
    rankedLessons = mergeGroupAndRerank(vectorMatches, lexicalMatches, question, { topK: 3 });

    matches = rankedLessons;
    contextText = rankedLessons.map(l => {
      const chunkSnippet = l.chunks && l.chunks.length > 0 ? l.chunks.join("\n") : "(Tài liệu bài học)";
      return `[Bài học: "${l.lessonTitle}" - Chương: "${l.sectionTitle}" (Lesson ID: ${l.lessonId}) - Độ tin cậy: ${(l.rerankScore * 100).toFixed(1)}%]\n${chunkSnippet}`;
    }).join("\n\n");
  } else {
    // 2.B. Current-Lesson Retrieval hoặc V1 Rollback Mode: Giữ nguyên truy xuất độc lập theo lesson_id
    if (isV2) {
      queryOptions.topK = 2;
      const parsedLessonId = Number(lessonId);
      if (!isNaN(parsedLessonId) && parsedLessonId > 0) {
        queryOptions.filter = {
          lesson_id: { $eq: parsedLessonId },
          schema_version: { $eq: 'v2' }
        };
      }
    } else {
      queryOptions.topK = 2;
      const parsedLessonId = Number(lessonId);
      if (!isNaN(parsedLessonId) && parsedLessonId > 0) {
        queryOptions.filter = {
          lesson_id: { $eq: parsedLessonId }
        };
      }
    }

    try {
      if (targetIndex) {
        const queryResponse = await targetIndex.query(queryOptions);
        matches = queryResponse.matches || [];
      }
    } catch (pcErr) {
      handlePineconeError(pcErr, 'Pinecone Retrieval');
    }

    contextText = matches
      .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
      .filter(Boolean)
      .join("\n");

    // 2.C. PostgreSQL Grounding Fallback: Nếu Pinecone rỗng hoặc chưa nạp vector cho bài học này,
    // tự động truy vấn trực tiếp thông tin bài học & phụ đề từ PostgreSQL để AI luôn hiểu rõ bài học
    if (!contextText && lessonId && Number(lessonId) > 0) {
      try {
        const parsedId = Number(lessonId);
        const hierarchyRes = await db.query(`
          SELECT l.lesson_id, l.title as lesson_title, s.title as section_title, c.course_name, c.description as course_description
          FROM lessons l
          JOIN sections s ON l.section_id = s.section_id
          JOIN courses c ON s.course_id = c.course_id
          WHERE l.lesson_id = $1 LIMIT 1
        `, [parsedId]);

        if (hierarchyRes.rows.length > 0) {
          const row = hierarchyRes.rows[0];
          let subText = '';
          try {
            const subRes = await db.query('SELECT cues FROM lesson_subtitles WHERE lesson_id = $1 LIMIT 1', [parsedId]);
            if (subRes.rows.length > 0 && subRes.rows[0].cues) {
              const cues = Array.isArray(subRes.rows[0].cues) ? subRes.rows[0].cues : JSON.parse(subRes.rows[0].cues);
              if (cues && cues.length > 0) {
                subText = cues.slice(0, 35).map(c => `[${c.startFormatted || c.start}s] (EN) ${c.en || ''} - (VI) ${c.vi || ''}`).join('\n');
              }
            }
          } catch (_) {}

          contextText = [
            `[BÀI HỌC]: "${row.lesson_title}" | [CHƯƠNG]: "${row.section_title}" | [KHÓA HỌC]: "${row.course_name}"`,
            row.course_description ? `[Mô tả khóa học]: ${row.course_description}` : '',
            subText ? `\n[NỘI DUNG LỜI THOẠI BÀI HỌC]:\n${subText}` : ''
          ].filter(Boolean).join('\n');
        }
      } catch (dbErr) {
        console.warn('[PostgreSQL Grounding Fallback Warning]:', dbErr.message);
      }
    }
  }

  return { contextText, matches, rankedLessons };
};

const { routeIntent, INTENTS } = require('./intentRouter.service');
const { contextualizeQuery, getRecentConversationHistory } = require('./queryRewriter.service');
const { buildVerifiedSources, formatTimestamp, validateTimestamp } = require('./sourceBuilder.service');

/**
 * Trích xuất các đoạn phụ đề theo mốc thời gian (Time-Window Subtitle Retrieval)
 * - Tự động nhận diện ngữ nghĩa thời gian: "phần vừa rồi", "phần tiếp theo", "đoạn này"
 * - Cửa sổ mặc định: [currentTime - 45s, currentTime + 45s]
 * - Cửa sổ quá khứ: [currentTime - 60s, currentTime]
 * - Cửa sổ tương lai: [currentTime, currentTime + 60s]
 */
async function getTranscriptWindowContext(lessonId, currentTime, question = '') {
  if (!lessonId || currentTime === null || currentTime === undefined || isNaN(Number(currentTime))) {
    return { contextSnippet: '', startTime: null, endTime: null, cuesFound: false };
  }

  const curTime = Number(currentTime);
  if (curTime < 0) {
    return { contextSnippet: '', startTime: null, endTime: null, cuesFound: false };
  }

  // 1. Phân tích hướng thời gian trong câu hỏi
  const q = (question || '').toLowerCase();
  const isPastReference = /phần vừa rồi|vừa nói gì|vừa xong|trước đó|câu vừa rồi|đoạn vừa qua|previous|just said|just now/i.test(q);
  const isFutureReference = /phần tiếp theo|đoạn sau|tiếp theo là gì|tiếp theo|next part|coming up/i.test(q);

  let windowStart = Math.max(0, curTime - 45);
  let windowEnd = curTime + 45;

  if (isPastReference) {
    windowStart = Math.max(0, curTime - 60);
    windowEnd = Math.max(curTime, 5);
  } else if (isFutureReference) {
    windowStart = curTime;
    windowEnd = curTime + 60;
  }

  try {
    const subRes = await db.query(
      'SELECT cues FROM lesson_subtitles WHERE lesson_id = $1 LIMIT 1',
      [Number(lessonId)]
    );

    if (subRes.rows.length === 0 || !Array.isArray(subRes.rows[0].cues) || subRes.rows[0].cues.length === 0) {
      return { contextSnippet: '', startTime: null, endTime: null, cuesFound: false };
    }

    const allCues = subRes.rows[0].cues;
    // Lọc các cues giao với cửa sổ thời gian [windowStart, windowEnd]
    const matchedCues = allCues.filter(c => {
      const start = Number(c.start);
      const end = Number(c.end);
      return !isNaN(start) && !isNaN(end) && start <= windowEnd && end >= windowStart;
    });

    if (matchedCues.length === 0) {
      // Fallback: Tìm cue gần nhất với currentTime
      let closestCue = null;
      let minDiff = Infinity;
      for (const c of allCues) {
        const diff = Math.abs(Number(c.start) - curTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestCue = c;
        }
      }
      if (closestCue) {
        matchedCues.push(closestCue);
      }
    }

    if (matchedCues.length === 0) {
      return { contextSnippet: '', startTime: null, endTime: null, cuesFound: false };
    }

    matchedCues.sort((a, b) => Number(a.start) - Number(b.start));

    // Tìm cue trọng tâm nhất
    let bestCue = matchedCues[0];
    let minDistance = Infinity;
    for (const c of matchedCues) {
      const start = Number(c.start);
      const end = Number(c.end);
      if (curTime >= start && curTime <= end) {
        bestCue = c;
        break;
      }
      const dist = Math.abs(start - curTime);
      if (dist < minDistance) {
        minDistance = dist;
        bestCue = c;
      }
    }

    const snippetLines = matchedCues.map(c => {
      const timeTag = c.startFormatted ? `[${c.startFormatted}]` : `[${formatTimestamp(c.start)}]`;
      return `${timeTag} ${c.en ? `(EN) ${c.en}` : ''} ${c.vi ? `(VI) ${c.vi}` : ''}`.trim();
    });

    return {
      contextSnippet: `NỘI DUNG PHỤ ĐỀ BÀI HỌC TẠI MỐC THỜI GIAN HIỆN TẠI (Thời điểm xem: ${formatTimestamp(curTime)}):\n` + snippetLines.join('\n'),
      startTime: Number(bestCue.start),
      endTime: Number(bestCue.end),
      cuesFound: true
    };
  } catch (err) {
    console.warn('[Transcript Window Error]:', err.message);
    return { contextSnippet: '', startTime: null, endTime: null, cuesFound: false };
  }
}

/**
 * Lấy toàn bộ ngữ cảnh thực tế của bài học từ PostgreSQL (Subtitle transcript, Materials, Speaking, Hierarchy)
 * Đảm bảo 100% Dynamic cho tất cả khóa học hiện tại và tương lai (Zero hard-coding)
 */
async function getLessonFullContext(lessonId, accessInfo = null) {
  if (!lessonId || Number(lessonId) <= 0) return null;
  const parsedLessonId = Number(lessonId);

  // 1. Lấy thông tin bài học và phân cấp (lesson -> section -> course) từ PostgreSQL
  const hierarchyRes = await db.query(`
    SELECT 
      l.lesson_id, l.title as lesson_title, l.content_type, l.content_url,
      l.speaking_sentences, l.speaking_questions,
      s.section_id, s.title as section_title,
      c.course_id, c.course_name, c.description as course_description
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    WHERE l.lesson_id = $1
    LIMIT 1
  `, [parsedLessonId]);

  if (hierarchyRes.rows.length === 0) return null;
  const lesson = hierarchyRes.rows[0];

  // 2. Lấy phụ đề transcript
  let subtitleText = '';
  let subtitleCues = [];
  try {
    const subRes = await db.query(
      'SELECT cues, en_vtt, vi_vtt FROM lesson_subtitles WHERE lesson_id = $1 LIMIT 1',
      [parsedLessonId]
    );
    if (subRes.rows.length > 0 && subRes.rows[0].cues) {
      subtitleCues = subRes.rows[0].cues;
      if (Array.isArray(subtitleCues) && subtitleCues.length > 0) {
        subtitleText = subtitleCues.map(c => c.en ? `${c.en} ${c.vi ? `(${c.vi})` : ''}` : '').filter(Boolean).join('\n');
      }
    }
  } catch (err) {
    console.warn(`[QuickAction] Cảnh báo đọc phụ đề lessonId=${lessonId}:`, err.message);
  }

  // 3. Lấy tài liệu đính kèm nếu có
  let materialsText = '';
  try {
    const matRes = await db.query(
      'SELECT file_name, file_url FROM lesson_materials WHERE lesson_id = $1',
      [parsedLessonId]
    );
    if (matRes.rows.length > 0) {
      materialsText = matRes.rows.map(m => `[Tài liệu đính kèm: ${m.file_name}]`).join('\n');
    }
  } catch (err) {
    console.warn(`[QuickAction] Cảnh báo đọc tài liệu lessonId=${lessonId}:`, err.message);
  }

  // 4. Lấy nội dung luyện nói nếu có
  let speakingText = '';
  if (lesson.speaking_sentences) {
    speakingText += `[Mẫu câu luyện nói]: ${JSON.stringify(lesson.speaking_sentences)}\n`;
  }
  if (lesson.speaking_questions) {
    speakingText += `[Câu hỏi luyện nói]: ${JSON.stringify(lesson.speaking_questions)}\n`;
  }

  const combinedContext = [
    `BÀI HỌC: "${lesson.lesson_title}"`,
    `CHƯƠNG: "${lesson.section_title}" | KHÓA HỌC: "${lesson.course_name}"`,
    subtitleText ? `\n--- NỘI DUNG LỜI THOẠI & PHỤ ĐỀ BÀI HỌC ---\n${subtitleText}` : '',
    materialsText ? `\n--- TÀI LIỆU VĂN BẢN ĐÍNH KÈM ---\n${materialsText}` : '',
    speakingText ? `\n--- NỘI DUNG LUYỆN NÓI ---\n${speakingText}` : ''
  ].filter(Boolean).join('\n');

  return {
    lesson,
    courseId: Number(lesson.course_id),
    combinedContext,
    hasContent: Boolean(subtitleText || materialsText || speakingText),
    cuesCount: subtitleCues.length
  };
}

/**
 * Xử lý Quick Action: Trích xuất Từ vựng & Thuật ngữ Trọng tâm (LESSON_KEY_VOCAB)
 */
async function handleLessonKeyVocab(userId, lessonId, onChunk = null) {
  const accessInfo = await verifyLessonAndCourseAccess(userId, lessonId);
  const lessonContext = await getLessonFullContext(lessonId, accessInfo);

  if (!lessonContext || !lessonContext.hasContent) {
    const fallbackMsg = `Bài học "${accessInfo.lesson?.lesson_title || 'này'}" hiện tại chưa có đủ dữ liệu lời thoại phụ đề hoặc tài liệu văn bản để trích xuất từ vựng trọng tâm. Bạn có thể đặt câu hỏi trực tiếp hoặc chuyển sang bài học khác để tiếp tục ôn luyện nhé!`;
    if (onChunk) onChunk({ type: 'token', text: fallbackMsg });
    return {
      success: true,
      reply: fallbackMsg,
      intent: 'CURRENT_LESSON_QA',
      sources: [
        {
          lessonId: Number(lessonId),
          lessonTitle: accessInfo.lesson?.lesson_title || 'Bài học hiện tại',
          sectionTitle: accessInfo.lesson?.section_title || 'Chương trình học',
          courseName: accessInfo.lesson?.course_name,
          badgeText: 'Bài học hiện tại'
        }
      ],
      actions: [
        {
          type: 'OPEN_LESSON',
          lessonId: Number(lessonId),
          lessonTitle: accessInfo.lesson?.lesson_title,
          sectionTitle: accessInfo.lesson?.section_title
        }
      ]
    };
  }

  const prompt = `Bạn là Trợ lý Giảng dạy Tiếng Anh chuyên nghiệp của nền tảng E-Learn Academy.
NHIỆM VỤ: Dựa vào NỘI DUNG THỰC TẾ CỦA BÀI HỌC dưới đây, hãy trích xuất 5 đến 8 TỪ VỰNG, THUẬT NGỮ NGỮ PHÁP, HOẶC CỤM TỪ TRỌNG TÂM (Key Vocabulary & Essential Terms).

QUY TẮC BẮT BUỘC:
1. CHỈ trích xuất kiến thức và thuật ngữ XUẤT HIỆN HOẶC ĐƯỢC GIẢNG DẠY TRONG BÀI HỌC DƯỚI ĐÂY. Tuyệt đối KHÔNG đưa thêm từ vựng ngẫu nhiên ngoài bài.
2. Trình bày rõ ràng, đẹp mắt bằng Markdown:
   - **Từ / Thuật ngữ (Term)** (kèm từ loại / phiên âm IPA nếu có)
   - **Nghĩa tiếng Việt (Meaning)**
   - **Ví dụ trong bài (Example sentence from lesson context)**
   - **Ghi chú sử dụng (Usage Note)**
3. Đưa ra lời khuyên ngắn gọn để ghi nhớ tốt các từ vựng này.

--- NỘI DUNG BÀI HỌC:
${lessonContext.combinedContext}`;

  let replyText = '';
  if (onChunk) {
    onChunk({
      type: 'metadata',
      intent: 'CURRENT_LESSON_QA',
      scope: 'current_lesson'
    });

    const responseStream = await geminiModel.generateContentStream(prompt);
    for await (const chunk of responseStream.stream) {
      const textChunk = chunk.text();
      if (textChunk) {
        replyText += textChunk;
        onChunk({ type: 'token', text: textChunk });
      }
    }
  } else {
    const result = await geminiModel.generateContent(prompt);
    replyText = result.response.text();
  }

  const sources = [
    {
      lessonId: Number(lessonId),
      lessonTitle: lessonContext.lesson.lesson_title,
      sectionTitle: lessonContext.lesson.section_title,
      courseName: lessonContext.lesson.course_name,
      badgeText: 'Từ vựng bài học'
    }
  ];
  const actions = [
    {
      type: 'OPEN_LESSON',
      lessonId: Number(lessonId),
      lessonTitle: lessonContext.lesson.lesson_title,
      sectionTitle: lessonContext.lesson.section_title
    }
  ];

  if (onChunk) {
    onChunk({ type: 'sources', sources, actions });
  }

  return {
    success: true,
    reply: replyText,
    intent: 'CURRENT_LESSON_QA',
    sources,
    actions
  };
}

/**
 * Xử lý Quick Action: Tạo Bài tập Ôn tập Nhanh (LESSON_QUICK_QUIZ)
 */
async function handleLessonQuickQuiz(userId, lessonId, onChunk = null) {
  const accessInfo = await verifyLessonAndCourseAccess(userId, lessonId);
  const lessonContext = await getLessonFullContext(lessonId, accessInfo);

  if (!lessonContext || !lessonContext.hasContent) {
    const fallbackQuestions = [
      {
        question: `Nội dung cốt lõi của bài học "${accessInfo.lesson?.lesson_title || 'này'}" là gì?`,
        options: ["Ngữ pháp và luyện tập phản xạ", "Kỹ năng phát âm và từ vựng", "Luyện nghe hiểu qua ngữ cảnh", "Cả 3 phương án trên"],
        correctAnswer: 3,
        explanation: "Bài học cung cấp kiến thức toàn diện kết hợp nghe, từ vựng và bài tập thực hành."
      }
    ];
    const fallbackPayload = {
      success: true,
      type: "LESSON_QUICK_QUIZ",
      lessonId: Number(lessonId),
      title: `Bài tập ôn tập: ${accessInfo.lesson?.lesson_title || 'Bài học'}`,
      questions: fallbackQuestions,
      quizData: fallbackQuestions
    };
    if (onChunk) {
      onChunk({ type: 'quiz', quizData: fallbackQuestions, title: fallbackPayload.title });
    }
    return fallbackPayload;
  }

  const quizPrompt = `Bạn là Chuyên gia Khảo thí Tiếng Anh của E-Learn Academy.
NHIỆM VỤ: Hãy tạo 3 đến 4 câu hỏi trắc nghiệm ôn tập nhanh (Quick Quiz) kiểm tra các kiến thức vừa học TRONG BÀI HỌC DƯỚI ĐÂY.

QUY TẮC BẮT BUỘC:
1. Chỉ kiểm tra kiến thức (ngữ pháp, từ vựng, cách dùng câu) ĐƯỢC GIẢNG DẠY TRONG BÀI HỌC DƯỚI ĐÂY.
2. Mỗi câu hỏi gồm đúng 4 lựa chọn (options: mảng gồm 4 chuỗi), chỉ có 1 đáp án đúng duy nhất.
3. correctAnswer: chỉ số (index) 0, 1, 2, hoặc 3 tương ứng với lựa chọn đúng.
4. Cung cấp giải thích chi tiết (explanation) bằng tiếng Việt cho đáp án đúng.
5. Trả về ĐÚNG định dạng JSON Array thuần túy (không kèm markdown \`\`\`json, không kèm giải thích ngoài JSON):
[
  {
    "question": "Nội dung câu hỏi tiếng Anh hoặc tiếng Việt...",
    "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
    "correctAnswer": 0,
    "explanation": "Giải thích chi tiết vì sao đáp án này đúng theo bài học..."
  }
]

--- NỘI DUNG BÀI HỌC:
${lessonContext.combinedContext}`;

  let parsedQuestions = [];
  try {
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: quizPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const rawText = result.response.text();
    const cleanJson = rawText.replace(/```json\s*|```/g, '').trim();
    parsedQuestions = JSON.parse(cleanJson);

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error("Dữ liệu Quiz không phải là mảng hợp lệ.");
    }
  } catch (err) {
    console.warn(`[QuickQuiz] Cảnh báo parse JSON từ Gemini, fallback sang cấu trúc chuẩn:`, err.message);
    parsedQuestions = [
      {
        question: `Kiến thức trọng tâm trong bài "${lessonContext.lesson.lesson_title}" là gì?`,
        options: [
          "Quy tắc sử dụng và áp dụng trong ngữ cảnh",
          "Phát âm và từ vựng mở rộng",
          "Cấu trúc câu hoàn chỉnh",
          "Tất cả các ý trên"
        ],
        correctAnswer: 3,
        explanation: `Bài học "${lessonContext.lesson.lesson_title}" giúp người học nắm vững quy tắc cấu trúc và vận dụng vào thực tế.`
      }
    ];
  }

  // Chuẩn hóa câu hỏi đảm bảo đúng schema
  const normalizedQuestions = parsedQuestions.map((q, idx) => ({
    question: q.question || `Câu hỏi ${idx + 1}`,
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    correctAnswer: (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer <= 3) ? q.correctAnswer : 0,
    explanation: q.explanation || "Giải thích đáp án chính xác theo nội dung bài học."
  }));

  const quizPayload = {
    success: true,
    type: "LESSON_QUICK_QUIZ",
    lessonId: Number(lessonId),
    title: `Bài tập ôn tập: ${lessonContext.lesson.lesson_title}`,
    questions: normalizedQuestions,
    quizData: normalizedQuestions
  };

  if (onChunk) {
    onChunk({
      type: 'quiz',
      quizData: normalizedQuestions,
      title: quizPayload.title
    });
  }

  return quizPayload;
}

/**
 * Xử lý logic RAG Chat: tạo vector embedding, tìm kiếm ngữ cảnh với bộ lọc lesson_id, và sinh câu trả lời bằng Gemini
 */
const handleRagChat = async (userId, lessonId, question, retrievalMode = 'auto', currentTime = null, quickAction = null) => {
  try {
    // 0. Xử lý Structured Quick Actions nếu được yêu cầu trực tiếp
    if (quickAction === 'LESSON_KEY_VOCAB' || (question && /^(từ vựng trọng tâm|key vocabulary|từ vựng chính)/i.test(question.trim()))) {
      if (lessonId && Number(lessonId) > 0) {
        return await handleLessonKeyVocab(userId, lessonId);
      }
    }
    if (quickAction === 'LESSON_QUICK_QUIZ' || (question && /^(tạo bài tập ôn nhanh|quick quiz|làm bài tập ôn|tạo bài tập trắc nghiệm)/i.test(question.trim()))) {
      if (lessonId && Number(lessonId) > 0) {
        const quizRes = await handleLessonQuickQuiz(userId, lessonId);
        return {
          success: true,
          reply: `Tôi đã tạo cho bạn ${quizRes.questions.length} câu trắc nghiệm nhanh để ôn tập bài học này.`,
          quizData: quizRes.questions,
          intent: 'CURRENT_LESSON_QA',
          sources: [
            {
              lessonId: Number(lessonId),
              lessonTitle: quizRes.title,
              badgeText: 'Bài tập ôn tập'
            }
          ],
          actions: []
        };
      }
    }
    if (!question) {
      return { success: false, reply: "Vui lòng nhập câu hỏi.", intent: "GENERAL_ENGLISH_QA", sources: [], actions: [] };
    }

    // Kiểm tra an toàn (Guardrails) ngăn chặn lạm dụng AI để tìm cách hack hệ thống / gỡ bảo mật
    const checkSafety = question.toLowerCase();
    const toxicKeywords = ['hack', 'bypass', 'bẻ khóa', 'gỡ bảo mật', 'quocanh26012004', 'super admin', 'superadmin', 'cướp quyền', 'lạm quyền', 'user_token_limits', 'tokenlimit', 'reset-token'];
    if (toxicKeywords.some(keyword => checkSafety.includes(keyword))) {
      return {
        success: true,
        reply: "Xin lỗi, tôi là trợ lý học tiếng Anh ảo của E-Learn Academy. Tôi không được phép cung cấp thông tin hoặc hướng dẫn liên quan đến cấu trúc bảo mật hệ thống, cơ sở dữ liệu, mã nguồn, hoặc thay đổi quyền quản trị. Chúng ta hãy quay lại các chủ đề luyện tập tiếng Anh nhé!",
        intent: "GENERAL_ENGLISH_QA",
        sources: [],
        actions: []
      };
    }

    const accessInfo = await verifyLessonAndCourseAccess(userId, lessonId);
    const isGlobalChat = accessInfo.isGlobal;
    let contextText = "";
    let detectedIntent = null;
    let retrievalQuery = question;
    let rewriteInfo = null;
    let conversationHistory = [];
    let retrievalRes = null;
    let timestampInfo = null;

    if (userId) {
      conversationHistory = await getRecentConversationHistory(userId, lessonId, 6, { courseId: accessInfo.courseId });
    }

    if (isGlobalChat) {
      try {
        const coursesResult = await db.query(`
          SELECT course_name, description 
          FROM courses 
          ORDER BY course_id ASC
        `);
        const coursesList = coursesResult.rows;
        if (coursesList.length > 0) {
          contextText = "Dưới đây là danh sách các khóa học thực tế đang hoạt động trên hệ thống E-Learn Academy:\n" +
            coursesList.map((c, idx) => `${idx + 1}. Khóa học: "${c.course_name}" - Mô tả: ${c.description || "Không có mô tả"}`).join("\n");
        } else {
          contextText = "Hiện tại chưa có khóa học nào được đăng tải trên hệ thống.";
        }
      } catch (dbErr) {
        console.error("Lỗi lấy danh sách khóa học cho chatbot:", dbErr);
        contextText = "Không thể tải danh sách khóa học thực tế từ hệ thống.";
      }
    } else {
      const isDevOrAdmin = process.env.NODE_ENV !== 'production' || accessInfo.isAdmin;
      
      detectedIntent = await routeIntent(question, {
        lessonId,
        hasValidLesson: !isGlobalChat && Number(lessonId) > 0,
        courseId: accessInfo.courseId
      });

      let effectiveScope = detectedIntent.scope;
      if (isDevOrAdmin && (retrievalMode === 'force_course' || retrievalMode === 'course_wide')) {
        effectiveScope = 'course_wide';
      } else if (isDevOrAdmin && retrievalMode === 'force_lesson') {
        effectiveScope = 'current_lesson';
      }

      // Xử lý Time-window Transcript Retrieval nếu có currentTime và câu hỏi liên quan bài hiện tại
      if (
        (effectiveScope === 'current_lesson' || detectedIntent.intent === INTENTS.CURRENT_LESSON_QA) &&
        currentTime !== null && currentTime !== undefined && !isNaN(Number(currentTime)) && Number(currentTime) >= 0
      ) {
        const timeWindowRes = await getTranscriptWindowContext(lessonId, currentTime, question);
        if (timeWindowRes.cuesFound) {
          contextText = timeWindowRes.contextSnippet;
          timestampInfo = {
            lessonId: Number(lessonId),
            startTime: timeWindowRes.startTime,
            endTime: timeWindowRes.endTime
          };
        }
      }

      if (effectiveScope !== 'none' && !contextText) {
        rewriteInfo = await contextualizeQuery(question, conversationHistory, {
          userId,
          lessonId,
          courseId: accessInfo.courseId
        });
        retrievalQuery = rewriteInfo.retrievalQuery;

        retrievalRes = await retrieveContext(lessonId, retrievalQuery, effectiveScope, accessInfo.courseId);
        contextText = retrievalRes.contextText;
      }
    }

    // 3. Tạo Prompt Engineering gửi cho Gemini (Sử dụng Original Question và Context)
    const historySnippet = conversationHistory.length > 0
      ? `\nLỊCH SỬ HỘI THOẠI GẦN NHẤT:\n${conversationHistory.map(h => `${h.role}: ${h.content}`).join('\n')}\n`
      : "";

    const systemPrompt = isGlobalChat
      ? `Bạn là Trợ lý ảo học tiếng Anh của E-Learn Academy. E-Learn Academy là một nền tảng học tiếng Anh trực tuyến thông minh với các tính năng chính: Học từ vựng, ngữ pháp, luyện nghe qua video bảo mật, luyện phát âm/nói (Speaking) chấm điểm bằng AI, và làm bài trắc nghiệm (Quiz).
  
HƯỚNG DẪN TRẢ LỜI:
- Hãy trả lời một cách tự nhiên, thân thiện và trực tiếp (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- Nếu học viên hỏi về các khóa học, chương trình học hoặc giới thiệu website, hãy sử dụng NGỮ CẢNH HỆ THỐNG dưới đây để cung cấp thông tin chính xác về các khóa học thực tế đang hoạt động trên trang web. Hãy giới thiệu tự nhiên và hấp dẫn.
- Nếu học viên hỏi các câu hỏi tiếng Anh chung (ví dụ: giải thích ngữ pháp, từ vựng, giao tiếp tự do, dịch thuật), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để giảng dạy và hỗ trợ họ một cách chuyên nghiệp. Khi cung cấp từ vựng/câu mẫu tiếng Anh, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.
- Tuyệt đối không nhắc đến các cụm từ kỹ thuật như "dựa vào ngữ cảnh cung cấp", "theo tài liệu".
- Nếu người dùng hỏi về bản chất kỹ thuật của bạn (model AI nào, framework nào, được xây dựng ra sao), 
hãy trả lời ngắn gọn, trung thực rằng bạn được xây dựng dựa trên công nghệ AI của Google (Gemini), 
tùy biến riêng cho mục đích học tiếng Anh, rồi khéo léo dẫn dắt quay lại hỗ trợ học tập.
Luôn trả lời bằng đúng ngôn ngữ mà người dùng đang sử dụng để hỏi.
NGỮ CẢNH HỆ THỐNG:
${contextText}
${historySnippet}
CÂU HỎI CỦA HỌC VIÊN:
"${question}"`
      : `Bạn là một Trợ lý ảo học tiếng Anh thân thiện và nhiệt tình. Hãy đóng vai một giáo viên hướng dẫn tiếng Anh để trả lời câu hỏi của học viên một cách tự nhiên, sinh động và dễ hiểu.

HƯỚNG DẪN TRẢ LỜI:
- Trả lời một cách trực tiếp, tự nhiên và thân thiện (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- TUYỆT ĐỐI KHÔNG sử dụng các cụm từ máy móc như: "dựa vào ngữ cảnh", "theo tài liệu cung cấp", "không có tài liệu cụ thể nào", "trong ngữ cảnh này", v.v. Học viên không cần biết về hệ thống tài liệu phía sau.
- Nếu NGỮ CẢNH dưới đây có chứa thông tin liên quan đến câu hỏi, hãy ưu tiên sử dụng nó để trả lời.
- Nếu NGỮ CẢNH trống hoặc không liên quan trực tiếp (ví dụ học viên hỏi ngữ pháp chung, chào hỏi, hoặc yêu cầu từ vựng), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để trả lời học viên một cách chính xác nhất.
- Khi cung cấp từ vựng, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.

NGỮ CẢNH BÀI HỌC (Nếu có):
${contextText || "(Không có tài liệu bổ trợ cụ thể)"}
${historySnippet}
CÂU HỎI CỦA HỌC VIÊN:
"${question}"`;

    const result = await geminiModel.generateContent(systemPrompt);
    const reply = result.response ? result.response.text() : (typeof result === 'string' ? result : "");

    // 4. Xây dựng Structured Sources & Actions đã qua xác thực PostgreSQL
    let sources = [];
    let actions = [];
    const isCurrentLessonIntent = detectedIntent?.intent === INTENTS.CURRENT_LESSON_QA || 
      detectedIntent?.intent === 'SUMMARIZE_CURRENT_LESSON' || 
      detectedIntent?.intent === INTENTS.SUMMARIZE_CURRENT_LESSON;

    if (retrievalRes || timestampInfo || (!isGlobalChat && isCurrentLessonIntent)) {
      const verifiedOutput = await buildVerifiedSources({
        intent: detectedIntent ? detectedIntent.intent : 'SEARCH_LESSON',
        rankedLessons: retrievalRes?.rankedLessons || (retrievalRes?.matches ? retrievalRes.matches.map(m => ({ lessonId: m.metadata?.lesson_id, rerankScore: m.score })) : []),
        currentLessonId: lessonId,
        courseId: accessInfo.courseId,
        timestampInfo
      });
      sources = verifiedOutput.sources || [];
      actions = verifiedOutput.actions || [];
    }

    return {
      success: true,
      reply: reply || "Tôi đã nhận được câu hỏi nhưng không thể phản hồi ngay lúc này.",
      intent: detectedIntent?.intent || (isGlobalChat ? 'GENERAL_ENGLISH_QA' : 'CURRENT_LESSON_QA'),
      sources,
      actions
    };
  } catch (error) {
    console.error("Lỗi xảy ra tại handleRagChat:", error);
    return {
      success: false,
      reply: "Rất tiếc, đã có sự cố kết nối tới hệ thống AI Assistant. Vui lòng thử lại sau ít phút.",
      intent: "GENERAL_ENGLISH_QA",
      sources: [],
      actions: []
    };
  }
};

/**
 * Xử lý RAG Chat dạng Stream (Trả về async generator / stream chunks từ Gemini)
 */
const handleRagChatStream = async (userId, lessonId, question, onChunk, retrievalMode = 'auto', currentTime = null, quickAction = null) => {
  try {
    // 0. Xử lý Structured Quick Actions nếu được yêu cầu trực tiếp
    if (quickAction === 'LESSON_KEY_VOCAB' || (question && /^(từ vựng trọng tâm|key vocabulary|từ vựng chính)/i.test(question.trim()))) {
      if (lessonId && Number(lessonId) > 0) {
        return await handleLessonKeyVocab(userId, lessonId, onChunk);
      }
    }
    if (quickAction === 'LESSON_QUICK_QUIZ' || (question && /^(tạo bài tập ôn nhanh|quick quiz|làm bài tập ôn|tạo bài tập trắc nghiệm)/i.test(question.trim()))) {
      if (lessonId && Number(lessonId) > 0) {
        return await handleLessonQuickQuiz(userId, lessonId, onChunk);
      }
    }

    if (!question) {
      if (onChunk) onChunk({ type: 'token', text: "Vui lòng nhập câu hỏi." });
      return "Vui lòng nhập câu hỏi.";
    }

    // Kiểm tra an toàn Guardrails
    const checkSafety = question.toLowerCase();
    const toxicKeywords = ['hack', 'bypass', 'bẻ khóa', 'gỡ bảo mật', 'quocanh26012004', 'super admin', 'superadmin', 'cướp quyền', 'lạm quyền', 'user_token_limits', 'tokenlimit', 'reset-token'];
    if (toxicKeywords.some(keyword => checkSafety.includes(keyword))) {
      const safeReply = "Xin lỗi, tôi là trợ lý học tiếng Anh ảo của E-Learn Academy. Tôi không được phép cung cấp thông tin hoặc hướng dẫn liên quan đến cấu trúc bảo mật hệ thống, cơ sở dữ liệu, mã nguồn, hoặc thay đổi quyền quản trị. Chúng ta hãy quay lại các chủ đề luyện tập tiếng Anh nhé!";
      if (onChunk) onChunk({ type: 'token', text: safeReply });
      return safeReply;
    }

    const accessInfo = await verifyLessonAndCourseAccess(userId, lessonId);
    const isGlobalChat = accessInfo.isGlobal;
    let contextText = "";
    let detectedIntent = null;
    let retrievalQuery = question;
    let rewriteInfo = null;
    let conversationHistory = [];
    let retrievalRes = null;
    let timestampInfo = null;
    let effectiveScope = 'current_lesson';

    if (userId) {
      conversationHistory = await getRecentConversationHistory(userId, lessonId, 6, { courseId: accessInfo.courseId });
    }

    if (isGlobalChat) {
      try {
        const coursesResult = await db.query(`
          SELECT course_name, description 
          FROM courses 
          ORDER BY course_id ASC
        `);
        const coursesList = coursesResult.rows;
        if (coursesList.length > 0) {
          contextText = "Dưới đây là danh sách các khóa học thực tế đang hoạt động trên hệ thống E-Learn Academy:\n" +
            coursesList.map((c, idx) => `${idx + 1}. Khóa học: "${c.course_name}" - Mô tả: ${c.description || "Không có mô tả"}`).join("\n");
        } else {
          contextText = "Hiện tại chưa có khóa học nào được đăng tải trên hệ thống.";
        }
      } catch (dbErr) {
        console.error("Lỗi lấy danh sách khóa học cho chatbot:", dbErr);
        contextText = "Không thể tải danh sách khóa học thực tế từ hệ thống.";
      }
    } else {
      const isDevOrAdmin = process.env.NODE_ENV !== 'production' || accessInfo.isAdmin;

      detectedIntent = await routeIntent(question, {
        lessonId,
        hasValidLesson: !isGlobalChat && Number(lessonId) > 0,
        courseId: accessInfo.courseId
      });

      effectiveScope = detectedIntent.scope;
      if (isDevOrAdmin && (retrievalMode === 'force_course' || retrievalMode === 'course_wide')) {
        effectiveScope = 'course_wide';
      } else if (isDevOrAdmin && retrievalMode === 'force_lesson') {
        effectiveScope = 'current_lesson';
      }

      // Xử lý Time-window Transcript Retrieval nếu có currentTime và câu hỏi liên quan bài hiện tại
      if (
        (effectiveScope === 'current_lesson' || detectedIntent.intent === INTENTS.CURRENT_LESSON_QA) &&
        currentTime !== null && currentTime !== undefined && !isNaN(Number(currentTime)) && Number(currentTime) >= 0
      ) {
        const timeWindowRes = await getTranscriptWindowContext(lessonId, currentTime, question);
        if (timeWindowRes.cuesFound) {
          contextText = timeWindowRes.contextSnippet;
          timestampInfo = {
            lessonId: Number(lessonId),
            startTime: timeWindowRes.startTime,
            endTime: timeWindowRes.endTime
          };
        }
      }

      if (effectiveScope !== 'none' && !contextText) {
        rewriteInfo = await contextualizeQuery(question, conversationHistory, {
          userId,
          lessonId,
          courseId: accessInfo.courseId
        });
        retrievalQuery = rewriteInfo.retrievalQuery;

        retrievalRes = await retrieveContext(lessonId, retrievalQuery, effectiveScope, accessInfo.courseId);
        contextText = retrievalRes.contextText;
      }
    }

    // 1. Phát sự kiện Metadata (SSE)
    if (onChunk) {
      onChunk({
        type: 'metadata',
        intent: detectedIntent?.intent || (isGlobalChat ? 'GENERAL_ENGLISH_QA' : 'CURRENT_LESSON_QA'),
        scope: effectiveScope,
        rewrittenQuery: rewriteInfo?.rewritten ? retrievalQuery : undefined
      });
    }

    const systemPrompt = isGlobalChat
      ? `Bạn là Trợ lý ảo học tiếng Anh của E-Learn Academy. E-Learn Academy là một nền tảng học tiếng Anh trực tuyến thông minh với các tính năng chính: Học từ vựng, ngữ pháp, luyện nghe qua video bảo mật, luyện phát âm/nói (Speaking) chấm điểm bằng AI, và làm bài trắc nghiệm (Quiz).
  
HƯỚNG DẪN TRẢ LỜI:
- Hãy trả lời một cách tự nhiên, thân thiện và trực tiếp (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- Nếu học viên hỏi về các khóa học, chương trình học hoặc giới thiệu website, hãy sử dụng NGỮ CẢNH HỆ THỐNG dưới đây để cung cấp thông tin chính xác về các khóa học thực tế đang hoạt động trên trang web. Hãy giới thiệu tự nhiên và hấp dẫn.
- Nếu học viên hỏi các câu hỏi tiếng Anh chung (ví dụ: giải thích ngữ pháp, từ vựng, giao tiếp tự do, dịch thuật), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để giảng dạy và hỗ trợ họ một cách chuyên nghiệp. Khi cung cấp từ vựng/câu mẫu tiếng Anh, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.
- Tuyệt đối không nhắc đến các cụm từ kỹ thuật như "dựa vào ngữ cảnh cung cấp", "theo tài liệu".

NGỮ CẢNH HỆ THỐNG:
${contextText}

CÂU HỎI CỦA HỌC VIÊN:
"${question}"`
      : `Bạn là một Trợ lý ảo học tiếng Anh thân thiện và nhiệt tình. Hãy đóng vai một giáo viên hướng dẫn tiếng Anh để trả lời câu hỏi của học viên một cách tự nhiên, sinh động và dễ hiểu.

HƯỚNG DẪN TRẢ LỜI:
- Trả lời một cách trực tiếp, tự nhiên và thân thiện (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- TUYỆT ĐỐI KHÔNG sử dụng các cụm từ máy móc như: "dựa vào ngữ cảnh", "theo tài liệu cung cấp", "không có tài liệu cụ thể nào", "trong ngữ cảnh này", v.v. Học viên không cần biết về hệ thống tài liệu phía sau.
- Nếu NGỮ CẢNH dưới đây có chứa thông tin liên quan đến câu hỏi, hãy ưu tiên sử dụng nó để trả lời.
- Nếu NGỮ CẢNH trống hoặc không liên quan trực tiếp (ví dụ học viên hỏi ngữ pháp chung, chào hỏi, hoặc yêu cầu từ vựng), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để trả lời học viên một cách chính xác nhất.
- Khi cung cấp từ vựng, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.

NGỮ CẢNH BÀI HỌC (Nếu có):
${contextText || "(Không có tài liệu bổ trợ cụ thể)"}

CÂU HỎI CỦA HỌC VIÊN:
"${question}"`;

    const resultStream = await geminiModel.generateContentStream(systemPrompt);
    let fullText = "";

    for await (const chunk of resultStream.stream) {
      const text = chunk.text();
      fullText += text;
      if (onChunk) {
        onChunk({ type: 'token', text });
      }
    }

    // 2. Phát sự kiện Sources & Actions (SSE)
    let sources = [];
    let actions = [];
    const isCurrentLessonIntent = detectedIntent?.intent === INTENTS.CURRENT_LESSON_QA || 
      detectedIntent?.intent === 'SUMMARIZE_CURRENT_LESSON' || 
      detectedIntent?.intent === INTENTS.SUMMARIZE_CURRENT_LESSON;

    if (retrievalRes || timestampInfo || (!isGlobalChat && isCurrentLessonIntent)) {
      const verifiedOutput = await buildVerifiedSources({
        intent: detectedIntent ? detectedIntent.intent : 'SEARCH_LESSON',
        rankedLessons: retrievalRes?.rankedLessons || (retrievalRes?.matches ? retrievalRes.matches.map(m => ({ lessonId: m.metadata?.lesson_id, rerankScore: m.score })) : []),
        currentLessonId: lessonId,
        courseId: accessInfo.courseId,
        timestampInfo
      });
      sources = verifiedOutput.sources || [];
      actions = verifiedOutput.actions || [];
    }

    if (onChunk && sources.length > 0) {
      onChunk({ type: 'sources', sources, actions });
    }

    return {
      fullText,
      intent: detectedIntent?.intent || (isGlobalChat ? 'GENERAL_ENGLISH_QA' : 'CURRENT_LESSON_QA'),
      sources,
      actions
    };
  } catch (error) {
    console.error("Lỗi xảy ra tại handleRagChatStream:", error);
    throw new Error("Hệ thống AI Assistant đang bận.");
  }
};

/**
 * Đối tượng service tương thích với các API hiện tại
 */
class ChatbotService {
  async ask(question, lessonId, userId = null, scope = 'auto', currentTime = null, quickAction = null) {
    try {
      let retrievalMode = 'auto';
      if (scope === 'course' || scope === 'course_wide' || scope === 'force_course') {
        retrievalMode = 'course_wide';
      } else if (scope === 'force_lesson') {
        retrievalMode = 'force_lesson';
      }
      const result = await handleRagChat(userId, lessonId, question, retrievalMode, currentTime, quickAction);
      return result;
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.ask:", error);

      const chatbotError = new Error(error.message || "Dịch vụ Chatbot AI tạm thời gặp sự cố");
      chatbotError.name = "ChatbotError";
      chatbotError.status = 503;
      throw chatbotError;
    }
  }

  async askStream(question, lessonId, userId, onChunk, scope = 'auto', currentTime = null, quickAction = null) {
    try {
      let retrievalMode = 'auto';
      if (scope === 'course' || scope === 'course_wide' || scope === 'force_course') {
        retrievalMode = 'course_wide';
      } else if (scope === 'force_lesson') {
        retrievalMode = 'force_lesson';
      }
      return await handleRagChatStream(userId, lessonId, question, onChunk, retrievalMode, currentTime, quickAction);
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.askStream:", error);
      throw error;
    }
  }

  async generateQuiz(lessonId, userId = null) {
    try {
      return await handleLessonQuickQuiz(userId, lessonId);
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.generateQuiz:", error);
      throw error;
    }
  }

  async saveHistory(userId, lessonId, question, answer, sources = [], actions = []) {
    try {
      const finalLessonId = (lessonId === 0 || lessonId === '0' || lessonId === null || lessonId === undefined || lessonId === 'null') ? null : lessonId;

      // 1. Lưu câu hỏi của user
      const insertUserQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'user', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const userResult = await db.query(insertUserQuery, [userId, finalLessonId, question]);

      // 2. Lưu câu trả lời của bot/ai (Có lưu kèm sources nếu có)
      const botContent = (sources && sources.length > 0)
        ? JSON.stringify({ answer, sources, actions: actions || [] })
        : answer;

      const insertBotQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'bot', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const botResult = await db.query(insertBotQuery, [userId, finalLessonId, botContent]);

      return {
        userMessage: userResult.rows[0],
        botMessage: {
          ...botResult.rows[0],
          title: answer,
          sources: sources || [],
          actions: actions || []
        }
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.saveHistory:", error);
      throw error;
    }
  }

  async getHistory(userId, lessonId) {
    try {
      const hasLesson = lessonId && lessonId !== 'null' && lessonId !== 'undefined' && Number(lessonId) !== 0;

      // Tự động dọn dẹp các bản ghi cũ trước 00:00 giờ Việt Nam (UTC+7)
      try {
        await db.query(`
          DELETE FROM ai_chat 
          WHERE created_at < (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
        `);
      } catch (cleanErr) {
        console.warn('⚠️ Cảnh báo dọn dẹp tin nhắn AI cũ:', cleanErr.message);
      }

      const queryText = hasLesson
        ? `
          SELECT ai_chat, sender_type, title, created_at AS created_date
          FROM ai_chat
          WHERE student_id = $1 
            AND lesson_id = $2 
            AND created_at >= (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
          ORDER BY created_date ASC
        `
        : `
          SELECT ai_chat, sender_type, title, created_at AS created_date
          FROM ai_chat
          WHERE student_id = $1 
            AND lesson_id IS NULL 
            AND created_at >= (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
          ORDER BY created_date ASC
        `;

      const params = hasLesson ? [userId, lessonId] : [userId];
      const result = await db.query(queryText, params);

      return result.rows.map(row => {
        let content = row.title;
        let sources = [];
        let actions = [];

        if (row.sender_type === 'bot' && row.title && row.title.startsWith('{') && row.title.endsWith('}')) {
          try {
            const parsed = JSON.parse(row.title);
            if (parsed.answer !== undefined) {
              content = parsed.answer;
              sources = parsed.sources || [];
              actions = parsed.actions || [];
            }
          } catch (e) {}
        }

        return {
          chat_id: row.ai_chat,
          sender: row.sender_type,
          message: content,
          title: content,
          sources,
          actions,
          created_date: row.created_date
        };
      });
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.getHistory:", error);
      throw error;
    }
  }

  async clearHistory(userId, lessonId = null) {
    try {
      if (lessonId !== undefined && lessonId !== null && lessonId !== 'all') {
        const hasLesson = lessonId !== 'null' && lessonId !== 'undefined' && Number(lessonId) !== 0;
        if (hasLesson) {
          await db.query('DELETE FROM ai_chat WHERE student_id = $1 AND lesson_id = $2', [userId, Number(lessonId)]);
        } else {
          await db.query('DELETE FROM ai_chat WHERE student_id = $1 AND lesson_id IS NULL', [userId]);
        }
        return { success: true, message: `Đã xóa lịch sử trò chuyện cho bài học ${hasLesson ? lessonId : 'toàn cục'}` };
      } else {
        await db.query('DELETE FROM ai_chat WHERE student_id = $1', [userId]);
        return { success: true, message: 'Đã xóa toàn bộ lịch sử trò chuyện AI' };
      }
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.clearHistory:", error);
      throw error;
    }
  }

  async generateQuiz(lessonId) {
    try {
      const isGlobalChat = !lessonId || Number(lessonId) === 0;
      let contextText = "";

      if (isGlobalChat) {
        try {
          const coursesResult = await db.query(`
            SELECT course_name, description 
            FROM courses 
            ORDER BY course_id ASC
          `);
          const coursesList = coursesResult.rows;
          if (coursesList.length > 0) {
            contextText = "Danh sách khóa học trên hệ thống:\n" +
              coursesList.map((c, idx) => `${idx + 1}. Khóa học: "${c.course_name}" - ${c.description || ""}`).join("\n");
          }
        } catch (dbErr) {
          console.warn("Lỗi lấy danh sách khóa học khi tạo quiz:", dbErr.message);
        }
      } else {
        try {
          const lessonRes = await db.query('SELECT title, content FROM lessons WHERE lesson_id = $1', [lessonId]);
          const lessonInfo = lessonRes.rows[0];
          const lessonTitle = lessonInfo?.title || `Bài học #${lessonId}`;

          const embeddingResult = await embeddingModel.embedContent({
            content: { parts: [{ text: `Kiến thức trọng tâm, ngữ pháp và từ vựng bài học ${lessonTitle}` }] },
            outputDimensionality: 768
          });
          const queryVector = embeddingResult.embedding?.values;

          if (queryVector) {
            const queryOptions = {
              vector: queryVector,
              topK: 3,
              includeMetadata: true,
              filter: { lesson_id: { $eq: Number(lessonId) } }
            };

            const queryResponse = await pineconeIndex.query(queryOptions);
            const matches = queryResponse.matches || [];
            const ragText = matches
              .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
              .filter(Boolean)
              .join("\n");

            contextText = `Tiêu đề bài học: ${lessonTitle}\nNội dung bổ trợ: ${ragText || lessonInfo?.content || ""}`;
          } else {
            contextText = `Tiêu đề bài học: ${lessonTitle}\nNội dung: ${lessonInfo?.content || ""}`;
          }
        } catch (ragErr) {
          console.warn("⚠️ Lỗi truy vấn Pinecone RAG khi tạo quiz, sử dụng thông tin DB:", ragErr.message);
          try {
            const lessonRes = await db.query('SELECT title, content FROM lessons WHERE lesson_id = $1', [lessonId]);
            if (lessonRes.rows.length > 0) {
              contextText = `Bài học: ${lessonRes.rows[0].title}\nNội dung: ${lessonRes.rows[0].content || ""}`;
            }
          } catch (e) {}
        }
      }

      const prompt = `You are a professional English teacher at E-Learn Academy.
Based on the following lesson/course context, generate EXACTLY 2 multiple-choice practice quiz questions (4 options each, exactly 1 correct answer) to test the student's comprehension, grammar, or vocabulary.

CONTEXT:
${contextText || "English grammar, vocabulary, and communication skills"}

REQUIREMENTS:
- Output MUST be a valid JSON array of exactly 2 quiz objects.
- Each quiz object MUST contain EXACTLY these keys:
  - "question": (string question in Vietnamese or English)
  - "options": (array of 4 distinct string choices)
  - "correctAnswer": (integer 0, 1, 2, or 3 pointing to the correct choice in options)
  - "explanation": (friendly, clear explanation in Vietnamese explaining why this answer is correct)

Ensure the response contains ONLY valid JSON without markdown code fences.`;

      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      let responseText = result.response.text();
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsedQuiz = JSON.parse(responseText);
      if (!Array.isArray(parsedQuiz) || parsedQuiz.length === 0) {
        throw new Error("Dữ liệu quiz từ AI không đúng định dạng mảng.");
      }

      return parsedQuiz;
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.generateQuiz:", error);
      throw new Error("Không thể tạo bài tập trắc nghiệm tự động: " + error.message);
    }
  }

  /**
   * Xử lý Audio đa năng: Voice Chatbot RAG (chat) hoặc Speaking Assessment (read_aloud / qa)
   */
  async processAudio(filePathOrBuffer, mimetype, options = {}) {
    const { mode = 'chat', targetText = null, questionText = null, questionId = null, lessonId = null, userId = null } = options;

    let audioBuffer;
    if (Buffer.isBuffer(filePathOrBuffer)) {
      audioBuffer = filePathOrBuffer;
    } else if (typeof filePathOrBuffer === 'string') {
      audioBuffer = fs.readFileSync(filePathOrBuffer);
    } else {
      throw new Error("Dữ liệu âm thanh không hợp lệ.");
    }

    const durationInfo = await extractAudioDurationSafely(audioBuffer, mimetype ? mimetype.split('/')[1] : 'webm');

    // Thực thi giới hạn thời lượng âm thanh 1-120s
    if (durationInfo.checked && durationInfo.duration !== null) {
      if (durationInfo.duration < 1.0) {
        const err = new Error("Đoạn âm thanh quá ngắn (dưới 1 giây). Vui lòng phát âm đầy đủ câu rồi nhấn hoàn thành.");
        err.status = 422;
        err.code = "AUDIO_TOO_SHORT";
        throw err;
      }
      if (durationInfo.duration > 120.0) {
        const err = new Error("Đoạn âm thanh vượt quá giới hạn 120 giây. Vui lòng ghi âm câu trả lời ngắn gọn hơn.");
        err.status = 422;
        err.code = "AUDIO_TOO_LONG";
        throw err;
      }
    }

    // 1. Phân hệ 1: Voice Chatbot RAG (mode === 'chat')
    if (mode === 'chat') {
      if (!audioBuffer || audioBuffer.length < 1000) {
        return {
          success: true,
          mode: 'chat',
          transcription: '',
          reply: 'Không nhận diện được giọng nói của bạn. Vui lòng thử lại hoặc gõ câu hỏi.',
          sources: [],
          actions: []
        };
      }

      const audioBase64 = audioBuffer.toString('base64');
      const transcribePrompt = `You are a speech-to-text transcriber for an English learning chatbot. Listen to the user's spoken audio and transcribe their English question or request accurately. Return ONLY the transcribed text without quotes or explanations. If completely silent or unintelligible noise, return empty string.`;

      const genResult = await geminiSpeakingModel.evaluateSpeaking({
        contents: [
          {
            role: "user",
            parts: [
              { text: transcribePrompt },
              { inlineData: { data: audioBase64, mimeType: mimetype || "audio/webm" } }
            ]
          }
        ],
        responseMimeType: "text/plain"
      });

      const transcription = (genResult.responseText || "").trim();
      if (!transcription) {
        return {
          success: true,
          mode: 'chat',
          transcription: '',
          reply: 'Không nhận diện được giọng nói trong bản ghi âm. Vui lòng nói to và rõ ràng hơn nhé.',
          sources: [],
          actions: []
        };
      }

      // Tái sử dụng luồng ask RAG hiện có của chatbot mà không làm ảnh hưởng logic RAG
      const askRes = await this.ask(transcription, lessonId, userId, 'lesson');
      const replyText = typeof askRes === 'string' ? askRes : (askRes.reply || '');

      return {
        success: true,
        mode: 'chat',
        transcription,
        reply: replyText,
        sources: askRes.sources || [],
        actions: askRes.actions || []
      };
    }

    // 2. Phân hệ 2 & 3: Speaking Assessment Engine V2 (Read Aloud & Q&A)
    const isSilence = !audioBuffer || audioBuffer.length < 1500;
    if (isSilence) {
      if (mode === 'read_aloud') {
        const scorerRes = speakingScorer.calculateReadAloudScore({
          targetText: targetText || '',
          transcription: '',
          pronunciationScore: 0,
          fluencyScore: 0,
          wordAssessments: []
        });

        return {
          success: true,
          version: 'speaking-v2',
          mode: 'read_aloud',
          transcription: '',
          overallScore: 0,
          components: scorerRes.components,
          feedback: {
            pronunciation: 'Không phát hiện tín hiệu giọng nói từ micro.',
            fluency: 'Chưa phát hiện giọng nói để đánh giá độ trôi chảy.',
            contentAccuracy: 'Chưa ghi nhận nội dung đọc.',
            completeness: 'Chưa hoàn thành câu đọc.'
          },
          suggestion: targetText || '',
          words: scorerRes.words,
          audioQuality: {
            hasSpeech: false,
            quality: 'no_speech',
            warning: 'Không phát hiện giọng nói hoặc âm lượng quá nhỏ.'
          },
          calibrationVersion: 'v1',
          modelUsed: null,
          duration: durationInfo.duration,
          durationChecked: durationInfo.checked
        };
      } else {
        // mode === 'qa'
        const scorerRes = speakingScorer.calculateQAScore({
          relevance: 0,
          grammar: 0,
          vocabulary: 0,
          pronunciation: 0,
          fluency: 0
        });

        return {
          success: true,
          version: 'speaking-v2',
          mode: 'qa',
          questionId: questionId || null,
          transcription: '',
          overallScore: 0,
          components: scorerRes.components,
          feedback: {
            relevance: 'Chưa ghi nhận câu trả lời cho câu hỏi.',
            grammar: 'Chưa ghi nhận cấu trúc câu để nhận xét ngữ pháp.',
            vocabulary: 'Chưa ghi nhận từ vựng.',
            pronunciation: 'Không phát hiện tín hiệu giọng nói.',
            fluency: 'Chưa ghi nhận giọng nói để đánh giá độ trôi chảy.'
          },
          suggestion: 'Please check your microphone and speak clearly.',
          words: [],
          audioQuality: {
            hasSpeech: false,
            quality: 'no_speech',
            warning: 'Không phát hiện giọng nói hoặc âm lượng quá nhỏ.'
          },
          calibrationVersion: 'v1',
          modelUsed: null,
          duration: durationInfo.duration,
          durationChecked: durationInfo.checked
        };
      }
    }

    const audioBase64 = audioBuffer.toString("base64");

    // Prompt chuyên biệt theo từng Mode
    let prompt;
    if (mode === 'read_aloud') {
      prompt = `You are a strict, professional English pronunciation assessor.
Target sentence to read aloud: "${targetText}".
Listen to the user's spoken audio waveform carefully.

Rules:
1. If silent, noise-only, or no speech detected:
   - "hasSpeech": false
   - "transcription": ""
   - "pronunciationScore": 0
   - "fluencyScore": 0
   - "wordAssessments": []
   - "quality": "no_speech"
   - "noiseLevel": "unknown"
   - "warning": "Không phát hiện giọng nói rõ ràng."
   - "pronunciationFeedback": "Không phát hiện giọng nói rõ ràng."
   - "fluencyFeedback": "Không ghi nhận giọng nói."
   - "generalFeedback": "Vui lòng kiểm tra micro và phát âm to hơn."
2. If speech detected:
   - "hasSpeech": true
   - "transcription": (exact English words spoken by user)
   - "pronunciationScore": (finite integer 0-100 evaluating acoustic phonemes, word stress, and ending sounds from audio)
   - "fluencyScore": (finite integer 0-100 evaluating speaking pace, rhythm, pauses from audio)
   - "wordAssessments": (array of objects for target words with acoustic evidence: [{"word": "example", "occurrenceIndex": 0, "status": "correct"|"mispronounced"|"uncertain", "confidence": 0.9, "feedback": "specific phoneme/stress issue or good"}])
   - "quality": ("good"|"poor"|"uncertain"|"no_speech")
   - "noiseLevel": ("low"|"medium"|"high"|"unknown")
   - "warning": (string warning or null)
   - "pronunciationFeedback": (actionable Vietnamese feedback on pronunciation)
   - "fluencyFeedback": (actionable Vietnamese feedback on fluency and rhythm)
   - "generalFeedback": (encouraging Vietnamese feedback)

Format response as strict JSON object with keys:
"hasSpeech", "transcription", "pronunciationScore", "fluencyScore", "wordAssessments", "quality", "noiseLevel", "warning", "pronunciationFeedback", "fluencyFeedback", "generalFeedback"`;
    } else {
      // mode === 'qa'
      prompt = `You are a strict, professional English conversational speaking assessor.
Question given to the student: "${questionText}".
Listen to the user's spoken audio response carefully.

Rules:
1. If silent, noise-only, or no speech detected:
   - "hasSpeech": false
   - "transcription": ""
   - "relevanceScore": 0
   - "grammarScore": 0
   - "vocabularyScore": 0
   - "pronunciationScore": 0
   - "fluencyScore": 0
   - "quality": "no_speech"
   - "noiseLevel": "unknown"
   - "warning": "Không phát hiện giọng nói."
   - "relevanceFeedback": "Chưa ghi nhận câu trả lời."
   - "grammarFeedback": "Chưa ghi nhận cấu trúc câu."
   - "vocabularyFeedback": "Chưa ghi nhận từ vựng."
   - "pronunciationFeedback": "Không phát hiện giọng nói."
   - "fluencyFeedback": "Không ghi nhận giọng nói."
   - "improvedAnswer": "Please speak clearly into your microphone."
2. If speech detected:
   - "hasSpeech": true
   - "transcription": (exact English words spoken by user)
   - "relevanceScore": (finite integer 0-100: How directly and appropriately does the answer address the question? Severe penalty (<30) if off-topic or answering an unrelated topic)
   - "grammarScore": (finite integer 0-100 based on transcript tenses, syntax, and subject-verb agreement)
   - "vocabularyScore": (finite integer 0-100 based on word diversity and appropriateness)
   - "pronunciationScore": (finite integer 0-100 based on acoustic phonemes and stress from audio)
   - "fluencyScore": (finite integer 0-100 based on pace and flow from audio)
   - "quality": ("good"|"poor"|"uncertain"|"no_speech")
   - "noiseLevel": ("low"|"medium"|"high"|"unknown")
   - "warning": (string warning or null)
   - "relevanceFeedback": (Vietnamese feedback regarding relevance to the prompt)
   - "grammarFeedback": (Vietnamese feedback regarding grammar)
   - "vocabularyFeedback": (Vietnamese feedback regarding vocabulary)
   - "pronunciationFeedback": (Vietnamese feedback regarding pronunciation)
   - "fluencyFeedback": (Vietnamese feedback regarding fluency)
   - "improvedAnswer": (a native, natural alternative response in English)

Format response as strict JSON object with keys:
"hasSpeech", "transcription", "relevanceScore", "grammarScore", "vocabularyScore", "pronunciationScore", "fluencyScore", "quality", "noiseLevel", "warning", "relevanceFeedback", "grammarFeedback", "vocabularyFeedback", "pronunciationFeedback", "fluencyFeedback", "improvedAnswer"`;
    }

    let validated = null;
    let lastError = null;
    let actualModelUsed = null;

    // Retry tối đa 1 lần nếu AI trả malformed JSON
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const aiResult = await geminiSpeakingModel.evaluateSpeaking({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { data: audioBase64, mimeType: mimetype || "audio/webm" } }
              ]
            }
          ],
          responseMimeType: "application/json"
        });

        actualModelUsed = aiResult.modelUsed || getSpeakingModelName();

        let rawText = (aiResult.responseText || "").trim();
        if (rawText.includes("```")) {
          rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        const parsedJson = JSON.parse(rawText);
        if (mode === 'read_aloud') {
          validated = speakingValidator.validateReadAloudResponse(parsedJson);
        } else {
          validated = speakingValidator.validateQAResponse(parsedJson);
        }
        break; // Validation thành công
      } catch (err) {
        lastError = err;
        console.warn(`[Speaking Assessment Attempt ${attempt + 1} Failed]:`, err.message);
      }
    }

    if (!validated) {
      console.error("Lỗi xác thực dữ liệu từ Speaking Model sau retry:", lastError?.message);
      const err = new Error(`Dịch vụ AI phản hồi dữ liệu không hợp lệ: ${lastError?.message || 'Lỗi cấu trúc phản hồi'}`);
      err.status = 503;
      err.code = 'AI_RESPONSE_INVALID';
      throw err;
    }

    const hasSpeech = validated.hasSpeech && Boolean(validated.transcription && validated.transcription.trim());

    if (mode === 'read_aloud') {
      if (!hasSpeech) {
        const scorerRes = speakingScorer.calculateReadAloudScore({
          targetText: targetText || '',
          transcription: '',
          pronunciationScore: 0,
          fluencyScore: 0,
          wordAssessments: []
        });

        return {
          success: true,
          version: 'speaking-v2',
          mode: 'read_aloud',
          transcription: '',
          overallScore: 0,
          components: scorerRes.components,
          feedback: {
            pronunciation: validated.feedback.pronunciation || 'Không phát hiện giọng nói rõ ràng.',
            fluency: validated.feedback.fluency || 'Chưa ghi nhận giọng nói.',
            contentAccuracy: 'Chưa ghi nhận nội dung câu đọc.',
            completeness: 'Chưa hoàn thành câu đọc.'
          },
          suggestion: targetText || '',
          words: scorerRes.words,
          audioQuality: validated.audioQuality,
          calibrationVersion: 'v1',
          modelUsed: actualModelUsed,
          duration: durationInfo.duration,
          durationChecked: durationInfo.checked
        };
      }

      const scorerRes = speakingScorer.calculateReadAloudScore({
        targetText: targetText || '',
        transcription: validated.transcription,
        pronunciationScore: validated.pronunciationScore,
        fluencyScore: validated.fluencyScore,
        wordAssessments: validated.wordAssessments || []
      });

      return {
        success: true,
        version: 'speaking-v2',
        mode: 'read_aloud',
        transcription: validated.transcription,
        overallScore: scorerRes.overallScore,
        components: scorerRes.components,
        feedback: {
          pronunciation: validated.feedback.pronunciation || 'Phát âm tương đối rõ ràng.',
          fluency: validated.feedback.fluency || 'Nhịp điệu nói đều đặn.',
          contentAccuracy: `Độ chính xác nội dung đạt ${scorerRes.components.contentAccuracy}%.`,
          completeness: `Mức độ hoàn thành câu đạt ${scorerRes.components.completeness}%.`,
          general: validated.feedback.general || 'Bạn đã hoàn thành bài đọc!'
        },
        suggestion: targetText || '',
        words: scorerRes.words,
        audioQuality: validated.audioQuality,
        calibrationVersion: 'v1',
        modelUsed: actualModelUsed,
        duration: durationInfo.duration,
        durationChecked: durationInfo.checked
      };
    } else {
      // mode === 'qa'
      if (!hasSpeech) {
        const scorerRes = speakingScorer.calculateQAScore({
          relevance: 0,
          grammar: 0,
          vocabulary: 0,
          pronunciation: 0,
          fluency: 0
        });

        return {
          success: true,
          version: 'speaking-v2',
          mode: 'qa',
          questionId: questionId || null,
          transcription: '',
          overallScore: 0,
          components: scorerRes.components,
          feedback: validated.feedback,
          suggestion: validated.improvedAnswer || 'Please speak clearly into your microphone.',
          words: [],
          audioQuality: validated.audioQuality,
          calibrationVersion: 'v1',
          modelUsed: actualModelUsed,
          duration: durationInfo.duration,
          durationChecked: durationInfo.checked
        };
      }

      const scorerRes = speakingScorer.calculateQAScore({
        relevance: validated.scores.relevance,
        grammar: validated.scores.grammar,
        vocabulary: validated.scores.vocabulary,
        pronunciation: validated.scores.pronunciation,
        fluency: validated.scores.fluency
      });

      return {
        success: true,
        version: 'speaking-v2',
        mode: 'qa',
        questionId: questionId || null,
        transcription: validated.transcription,
        overallScore: scorerRes.overallScore,
        scoreCapApplied: scorerRes.scoreCapApplied,
        scoreCapReason: scorerRes.scoreCapReason,
        components: scorerRes.components,
        feedback: validated.feedback,
        suggestion: validated.improvedAnswer || '',
        words: [],
        audioQuality: validated.audioQuality,
        calibrationVersion: 'v1',
        modelUsed: actualModelUsed,
        duration: durationInfo.duration,
        durationChecked: durationInfo.checked
      };
    }
  }

  /**
   * Chữ ký cũ tương thích ngược: evaluateAudio
   */
  async evaluateAudio(filePathOrBuffer, mimetype, targetText = null, isQA = false) {
    const mode = isQA ? 'qa' : (targetText ? 'read_aloud' : 'chat');
    return this.processAudio(filePathOrBuffer, mimetype, {
      mode,
      targetText,
      questionText: isQA ? targetText : null
    });
  }

  async getTokenBalance(userId) {
    try {
      // 1. Lấy role của user
      const userRes = await db.query('SELECT role_id FROM users WHERE user_id = $1', [userId]);
      if (userRes.rows.length === 0) {
        throw new Error('Người dùng không tồn tại');
      }

      const roleId = userRes.rows[0].role_id;
      let limit = 6000; // Học viên
      if (roleId === 1) limit = 999999999; // Admin
      else if (roleId === 2) limit = 7000; // Giảng viên

      const today = getVietnamDateString();

      // 2. Lấy thông tin ví token từ bảng user_token_limits
      const usageRes = await db.query(
        'SELECT max_tokens, used_tokens, remaining_tokens, reset_date FROM user_token_limits WHERE user_id = $1',
        [userId]
      );

      let tokens_used = 0;
      let tokens_remaining = limit;

      if (usageRes.rows.length > 0) {
        const record = usageRes.rows[0];
        const recordResetDate = record.reset_date ? new Date(record.reset_date).toISOString().split('T')[0] : '';

        if (recordResetDate !== today) {
          // Ngày mới: tự động reset hiển thị về 0/đầy
          tokens_used = 0;
          tokens_remaining = limit;
        } else {
          tokens_used = record.used_tokens;
          limit = record.max_tokens;
          tokens_remaining = record.remaining_tokens !== null && record.remaining_tokens !== undefined
            ? record.remaining_tokens
            : Math.max(0, limit - tokens_used);
        }
      }

      return {
        tokens_used,
        token_max_limit: limit,
        tokens_remaining
      };
    } catch (error) {
      console.error('Lỗi tại ChatbotService.getTokenBalance:', error);
      throw error;
    }
  }
}

const serviceInstance = new ChatbotService();

module.exports = {
  ask: (question, lessonId, userId, scope, currentTime, quickAction) => serviceInstance.ask(question, lessonId, userId, scope, currentTime, quickAction),
  askStream: (question, lessonId, userId, onChunk, scope, currentTime, quickAction) => serviceInstance.askStream(question, lessonId, userId, onChunk, scope, currentTime, quickAction),
  generateQuiz: (lessonId, userId) => serviceInstance.generateQuiz(lessonId, userId),
  saveHistory: (userId, lessonId, question, answer, sources, actions) => serviceInstance.saveHistory(userId, lessonId, question, answer, sources, actions),
  getHistory: (userId, lessonId) => serviceInstance.getHistory(userId, lessonId),
  clearHistory: (userId, lessonId) => serviceInstance.clearHistory(userId, lessonId),
  evaluateAudio: (filePath, mimetype, targetText, isQA) => serviceInstance.evaluateAudio(filePath, mimetype, targetText, isQA),
  processAudio: (filePath, mimetype, options) => serviceInstance.processAudio(filePath, mimetype, options),
  getTokenBalance: (userId) => serviceInstance.getTokenBalance(userId),
  handleRagChat,
  handleRagChatStream,
  verifyLessonAndCourseAccess,
  retrieveContext,
  getLessonFullContext,
  handleLessonKeyVocab,
  handleLessonQuickQuiz
};


