/**
 * Chatbot Service - Thực hiện quy trình nghiệp vụ RAG
 */

const { geminiModel, embeddingModel, pineconeIndex } = require("../../../utils/ai-clients");
const db = require("../../../config/database");

// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

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

    // Chạy song song Semantic Vector Search và PostgreSQL Lexical Search
    try {
      const [pcRes, lexRes] = await Promise.all([
        targetIndex ? targetIndex.query(queryOptions) : Promise.resolve({ matches: [] }),
        searchPostgreSQLLexical(question, Number(verifiedCourseId))
      ]);
      vectorMatches = pcRes.matches || [];
      lexicalMatches = lexRes || [];
    } catch (searchErr) {
      console.warn(`[Hybrid Retrieval Warning] ${searchErr.message}`);
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
      console.warn(`[Pinecone Retrieval Warning] ${pcErr.message}`);
    }

    contextText = matches
      .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
      .filter(Boolean)
      .join("\n");
  }

  return { contextText, matches, rankedLessons };
};

const { routeIntent, INTENTS } = require('./intentRouter.service');
const { contextualizeQuery, getRecentConversationHistory } = require('./queryRewriter.service');

/**
 * Xử lý logic RAG Chat: tạo vector embedding, tìm kiếm ngữ cảnh với bộ lọc lesson_id, và sinh câu trả lời bằng Gemini
 */
const handleRagChat = async (userId, lessonId, question, retrievalMode = 'auto') => {
  try {
    if (!question) {
      return { success: false, reply: "Vui lòng nhập câu hỏi." };
    }

    // Kiểm tra an toàn (Guardrails) ngăn chặn lạm dụng AI để tìm cách hack hệ thống / gỡ bảo mật
    const checkSafety = question.toLowerCase();
    const toxicKeywords = ['hack', 'bypass', 'bẻ khóa', 'gỡ bảo mật', 'quocanh26012004', 'super admin', 'superadmin', 'cướp quyền', 'lạm quyền', 'user_token_limits', 'tokenlimit', 'reset-token'];
    if (toxicKeywords.some(keyword => checkSafety.includes(keyword))) {
      return {
        success: true,
        reply: "Xin lỗi, tôi là trợ lý học tiếng Anh ảo của E-Learn Academy. Tôi không được phép cung cấp thông tin hoặc hướng dẫn liên quan đến cấu trúc bảo mật hệ thống, cơ sở dữ liệu, mã nguồn, hoặc thay đổi quyền quản trị. Chúng ta hãy quay lại các chủ đề luyện tập tiếng Anh nhé!"
      };
    }

    const accessInfo = await verifyLessonAndCourseAccess(userId, lessonId);
    const isGlobalChat = accessInfo.isGlobal;
    let contextText = "";
    let detectedIntent = null;
    let retrievalQuery = question;
    let rewriteInfo = null;
    let conversationHistory = [];

    if (userId) {
      conversationHistory = await getRecentConversationHistory(userId, lessonId, 6);
    }

    if (isGlobalChat) {
      // 1. Đối với Chatbot toàn cục: Lấy dữ liệu khóa học thật từ DB để AI trả lời đúng trọng tâm thông tin hệ thống
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
      // 2. Đối với AI Assistant trong bài học: Sử dụng Intent Router tự động phân giải phạm vi Retrieval
      const isDevOrAdmin = process.env.NODE_ENV !== 'production' || accessInfo.isAdmin;
      let effectiveScope = 'current_lesson';

      if (isDevOrAdmin && (retrievalMode === 'force_course' || retrievalMode === 'course_wide')) {
        effectiveScope = 'course_wide';
        console.log(`[Intent Router Debug] Overridden to course_wide by ${accessInfo.isAdmin ? 'Admin' : 'Dev Environment'}`);
      } else if (isDevOrAdmin && retrievalMode === 'force_lesson') {
        effectiveScope = 'current_lesson';
        console.log(`[Intent Router Debug] Overridden to current_lesson by ${accessInfo.isAdmin ? 'Admin' : 'Dev Environment'}`);
      } else {
        // Trong môi trường Production: Backend Intent Router là nguồn quyết định tuyệt đối
        detectedIntent = await routeIntent(question, {
          lessonId,
          hasValidLesson: !isGlobalChat && Number(lessonId) > 0,
          courseId: accessInfo.courseId
        });
        effectiveScope = detectedIntent.scope;
        console.log(`[Intent Router] Question: "${question.slice(0, 40)}..." -> Intent: ${detectedIntent.intent} | Scope: ${effectiveScope} (${detectedIntent.method})`);
      }

      if (effectiveScope !== 'none') {
        // 2.2. Conversational Query Rewriting: Tách biệt Original Query và Retrieval Query
        rewriteInfo = await contextualizeQuery(question, conversationHistory, {
          userId,
          lessonId,
          courseId: accessInfo.courseId
        });
        retrievalQuery = rewriteInfo.retrievalQuery;
        if (rewriteInfo.rewritten) {
          console.log(`[Query Rewriter] Rewrote: "${question}" -> "${retrievalQuery}" (${rewriteInfo.method}, ${rewriteInfo.latencyMs}ms)`);
        }

        const retrievalRes = await retrieveContext(lessonId, retrievalQuery, effectiveScope, accessInfo.courseId);
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

    return {
      success: true,
      reply: reply || "Tôi đã nhận được câu hỏi nhưng không thể phản hồi ngay lúc này."
    };
  } catch (error) {
    console.error("Lỗi xảy ra tại handleRagChat:", error);
    return {
      success: false,
      reply: "Rất tiếc, đã có sự cố kết nối tới hệ thống AI Assistant. Vui lòng thử lại sau ít phút."
    };
  }
};

/**
 * Xử lý RAG Chat dạng Stream (Trả về async generator / stream chunks từ Gemini)
 */
const handleRagChatStream = async (userId, lessonId, question, onChunk, retrievalMode = 'auto') => {
  try {
    if (!question) {
      if (onChunk) onChunk("Vui lòng nhập câu hỏi.");
      return "Vui lòng nhập câu hỏi.";
    }

    // Kiểm tra an toàn Guardrails
    const checkSafety = question.toLowerCase();
    const toxicKeywords = ['hack', 'bypass', 'bẻ khóa', 'gỡ bảo mật', 'quocanh26012004', 'super admin', 'superadmin', 'cướp quyền', 'lạm quyền', 'user_token_limits', 'tokenlimit', 'reset-token'];
    if (toxicKeywords.some(keyword => checkSafety.includes(keyword))) {
      const safeReply = "Xin lỗi, tôi là trợ lý học tiếng Anh ảo của E-Learn Academy. Tôi không được phép cung cấp thông tin hoặc hướng dẫn liên quan đến cấu trúc bảo mật hệ thống, cơ sở dữ liệu, mã nguồn, hoặc thay đổi quyền quản trị. Chúng ta hãy quay lại các chủ đề luyện tập tiếng Anh nhé!";
      if (onChunk) onChunk(safeReply);
      return safeReply;
    }

    const accessInfo = await verifyLessonAndCourseAccess(userId, lessonId);
    const isGlobalChat = accessInfo.isGlobal;
    let contextText = "";
    let detectedIntent = null;
    let retrievalQuery = question;
    let rewriteInfo = null;
    let conversationHistory = [];

    if (userId) {
      conversationHistory = await getRecentConversationHistory(userId, lessonId, 6);
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
      let effectiveScope = 'current_lesson';

      if (isDevOrAdmin && (retrievalMode === 'force_course' || retrievalMode === 'course_wide')) {
        effectiveScope = 'course_wide';
      } else if (isDevOrAdmin && retrievalMode === 'force_lesson') {
        effectiveScope = 'current_lesson';
      } else {
        detectedIntent = await routeIntent(question, {
          lessonId,
          hasValidLesson: !isGlobalChat && Number(lessonId) > 0,
          courseId: accessInfo.courseId
        });
        effectiveScope = detectedIntent.scope;
      }

      if (effectiveScope !== 'none') {
        rewriteInfo = await contextualizeQuery(question, conversationHistory, {
          userId,
          lessonId,
          courseId: accessInfo.courseId
        });
        retrievalQuery = rewriteInfo.retrievalQuery;

        const retrievalRes = await retrieveContext(lessonId, retrievalQuery, effectiveScope, accessInfo.courseId);
        contextText = retrievalRes.contextText;
      }
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
        onChunk(text);
      }
    }

    return fullText;
  } catch (error) {
    console.error("Lỗi xảy ra tại handleRagChatStream:", error);
    throw new Error("Hệ thống AI Assistant đang bận.");
  }
};

/**
 * Đối tượng service tương thích với các API hiện tại
 */
class ChatbotService {
  async ask(question, lessonId, userId = null, scope = 'auto') {
    try {
      let retrievalMode = 'auto';
      if (scope === 'course' || scope === 'course_wide' || scope === 'force_course') {
        retrievalMode = 'course_wide';
      } else if (scope === 'force_lesson') {
        retrievalMode = 'force_lesson';
      }
      const result = await handleRagChat(userId, lessonId, question, retrievalMode);
      return result.reply;
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.ask:", error);

      const chatbotError = new Error(error.message || "Dịch vụ Chatbot AI tạm thời gặp sự cố");
      chatbotError.name = "ChatbotError";
      chatbotError.status = 503;
      throw chatbotError;
    }
  }

  async askStream(question, lessonId, userId, onChunk, scope = 'auto') {
    try {
      let retrievalMode = 'auto';
      if (scope === 'course' || scope === 'course_wide' || scope === 'force_course') {
        retrievalMode = 'course_wide';
      } else if (scope === 'force_lesson') {
        retrievalMode = 'force_lesson';
      }
      return await handleRagChatStream(userId, lessonId, question, onChunk, retrievalMode);
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.askStream:", error);
      throw error;
    }
  }

  async saveHistory(userId, lessonId, question, answer) {
    try {
      const finalLessonId = (lessonId === 0 || lessonId === '0' || lessonId === null || lessonId === undefined || lessonId === 'null') ? null : lessonId;

      // 1. Lưu câu hỏi của user
      const insertUserQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'user', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const userResult = await db.query(insertUserQuery, [userId, finalLessonId, question]);

      // 2. Lưu câu trả lời của bot/ai
      const insertBotQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'bot', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const botResult = await db.query(insertBotQuery, [userId, finalLessonId, answer]);

      return {
        userMessage: userResult.rows[0],
        botMessage: botResult.rows[0]
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

      return result.rows.map(row => ({
        chat_id: row.ai_chat,
        sender: row.sender_type,
        message: row.title,
        created_date: row.created_date
      }));
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

  async evaluateAudio(filePathOrBuffer, mimetype, targetText = null, isQA = false) {
    try {
      let audioBuffer;
      if (Buffer.isBuffer(filePathOrBuffer)) {
        audioBuffer = filePathOrBuffer;
      } else if (typeof filePathOrBuffer === 'string') {
        const fs = require('fs');
        audioBuffer = fs.readFileSync(filePathOrBuffer);
      } else {
        throw new Error("Dữ liệu âm thanh không hợp lệ.");
      }

      // Tiền kiểm tra kích thước file âm thanh: Nếu < 1500 bytes (tương đương file rỗng / không có dữ liệu sóng âm) -> chấm 0 ngay lập tức
      if (!audioBuffer || audioBuffer.length < 1500) {
        const emptyWords = targetText ? targetText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/).filter(Boolean).map(w => ({
          word: w,
          correct: false,
          feedback: "Không nghe thấy âm thanh phát âm."
        })) : [];

        return {
          success: true,
          score: 0,
          pronunciation_accuracy: "0%",
          transcription: "Không nhận diện được giọng nói (Chưa phát âm)",
          grammarFeedback: "Chưa ghi nhận được câu trả lời. Bạn hãy ghi âm phát âm rõ ràng hơn nhé.",
          pronunciationFeedback: "Không phát hiện tín hiệu giọng nói từ micro. Vui lòng kiểm tra micro và phát âm to hơn.",
          detailed_feedback: "Không nhận diện được giọng nói của bạn. Vui lòng kiểm tra micro, nói to và rõ ràng hơn.",
          reply: "Không nhận diện được giọng nói của bạn. Vui lòng kiểm tra micro, nói to và rõ ràng hơn.",
          improved_sentence: targetText || "Please speak clearly into your microphone.",
          suggestion: targetText || "Please speak clearly into your microphone.",
          words: emptyWords,
          errors: ["Chưa phát hiện giọng nói qua micro."]
        };
      }

      const audioBase64 = audioBuffer.toString("base64");

      const prompt = `You are a professional, strict English pronunciation and speech evaluation AI.
Listen to the user's spoken audio waveform carefully and transcribe what was actually said.

${targetText ? `Target sentence to read aloud: "${targetText}". Compare their actual spoken pronunciation against this target sentence.` : ''}
${isQA ? `The user was responding to a conversational English practice prompt. Evaluate their response for grammar, vocabulary, pronunciation, and flow.` : ''}

CRITICAL ANTI-CHEAT & SILENCE DETECTION RULES:
1. If the audio is silent, contains NO human speech, contains only background hiss, breathing, background noise, or is incomprehensible silence:
   - "score": 0
   - "pronunciation_accuracy": "0%"
   - "transcription": ""
   - "detailed_feedback": "Không nhận diện được giọng nói của bạn. Vui lòng ghé sát micro và phát âm to, rõ ràng hơn."
   - "grammarFeedback": "Chưa ghi nhận được cấu trúc câu hay từ vựng trong đoạn ghi âm."
   - "pronunciationFeedback": "Không phát hiện âm thanh giọng nói. Hãy kiểm tra micro và phát âm rõ ràng hơn."
   ${targetText ? `- "words": (all words of the target sentence with "correct": false and "feedback": "Không nghe thấy từ này")` : ''}
   DO NOT hallucinate words or award any points for silence!

2. If the user DID speak:
   - "score": (number from 1 to 100 based on actual accuracy and pronunciation quality)
   - "pronunciation_accuracy": (string percentage, e.g. "85%")
   - "transcription": (exact English words spoken by user)
   - "grammarFeedback": (constructive feedback in friendly Vietnamese focusing EXCLUSIVELY on grammar, tense, word choice)
   - "pronunciationFeedback": (constructive feedback in friendly Vietnamese focusing EXCLUSIVELY on pronunciation, phonemes, stress, intonation)
   - "detailed_feedback": (encouraging feedback in friendly Vietnamese)
   - "improved_sentence": (a refined native English sentence suggestion)
   ${targetText ? `- "words": array of objects [{"word": "string", "correct": boolean, "feedback": "note if mispronounced or null if correct"}]` : ''}

Format the response as a JSON object containing EXACTLY these keys:
- "score": (number from 0 to 100)
- "pronunciation_accuracy": (string percentage, e.g. "85%")
- "transcription": (string)
- "grammarFeedback": (string in Vietnamese)
- "pronunciationFeedback": (string in Vietnamese)
- "detailed_feedback": (string in Vietnamese)
- "improved_sentence": (string)
${targetText ? `- "words": (array of objects)` : ''}

Ensure the response contains ONLY valid JSON without markdown formatting.`;

      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: mimetype || "audio/webm"
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      let responseText = result.response.text();
      // Clean up markdown block if present
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(responseText);

      const isNoSpeech = !parsed.transcription ||
        parsed.transcription.trim() === "" ||
        parsed.transcription.toLowerCase().includes("no discernible speech") ||
        parsed.transcription.toLowerCase().includes("no speech") ||
        parsed.transcription.toLowerCase().includes("silence") ||
        Number(parsed.score) === 0;

      let finalScore = isNoSpeech ? 0 : Math.max(0, Math.min(100, parsed.score !== undefined ? Number(parsed.score) : 0));
      let finalTranscription = isNoSpeech ? "Không nhận diện được giọng nói (Chưa phát âm)" : parsed.transcription;

      // Xử lý danh sách từ chi tiết nếu có targetText
      let evaluatedWords = [];
      if (targetText) {
        const cleanWords = targetText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/).filter(Boolean);
        if (isNoSpeech || finalScore === 0) {
          evaluatedWords = cleanWords.map(w => ({
            word: w,
            correct: false,
            feedback: "Không nghe thấy từ này."
          }));
        } else if (parsed.words && Array.isArray(parsed.words) && parsed.words.length > 0) {
          evaluatedWords = parsed.words;
        } else {
          evaluatedWords = cleanWords.map(w => ({
            word: w,
            correct: finalScore >= 60,
            feedback: finalScore >= 60 ? null : "Cần phát âm rõ ràng hơn."
          }));
        }
      }

      let finalGrammarFB = (parsed.grammarFeedback || "").trim();
      let finalPronunFB = (parsed.pronunciationFeedback || "").trim();

      if (isNoSpeech || finalScore === 0) {
        finalGrammarFB = "Chưa ghi nhận được câu trả lời có cấu trúc ngữ pháp và từ vựng. Bạn hãy thu âm lại một câu trả lời hoàn chỉnh nhé.";
        finalPronunFB = "Tín hiệu âm thanh thu được chưa đủ rõ ràng. Bạn hãy kiểm tra lại micro, ghé sát thiết bị và phát âm to hơn nhé.";
      } else {
        if (!finalGrammarFB || finalGrammarFB === finalPronunFB || finalGrammarFB === parsed.detailed_feedback) {
          finalGrammarFB = finalScore >= 80
            ? "Cấu trúc ngữ pháp chính xác, từ vựng được lựa chọn phù hợp và tự nhiên với ngữ cảnh câu hỏi."
            : "Cần chú ý chia đúng thì của động từ và bổ sung các từ nối để câu văn thêm mạch lạc.";
        }
        if (!finalPronunFB || finalGrammarFB === finalPronunFB || finalPronunFB === parsed.detailed_feedback) {
          finalPronunFB = finalScore >= 80
            ? "Phát âm các âm tiết rõ ràng, biết nhấn đúng trọng âm từ và duy trì ngữ điệu tự nhiên."
            : "Chú ý phát âm rõ các âm tiết cuối (ending sounds) và luyện tập nhấn đúng trọng âm từ.";
        }
      }

      // Hard enforcement: Guarantee distinct content
      if (finalGrammarFB === finalPronunFB) {
        finalGrammarFB = "Về Ngữ pháp & Từ vựng: Sử dụng cấu trúc câu phù hợp, các từ ngữ thể hiện rõ ý muốn diễn đạt.";
        finalPronunFB = "Về Phát âm & Ngữ điệu: Âm lượng vừa phải, phát âm các từ quen thuộc tương đối rõ ràng.";
      }

      let finalSuggestion = parsed.improved_sentence;
      if (isNoSpeech || !finalSuggestion || finalSuggestion.toLowerCase().includes("no discernible speech")) {
        finalSuggestion = targetText || "In my opinion, practicing English daily is the best way to improve fluency.";
      }

      // Map to frontend compatibility keys
      return {
        success: true,
        // Required keys
        score: finalScore,
        pronunciation_accuracy: `${finalScore}%`,
        transcription: finalTranscription,
        grammarFeedback: finalGrammarFB,
        pronunciationFeedback: finalPronunFB,
        detailed_feedback: (isNoSpeech || finalScore === 0)
          ? "Không nhận diện được giọng nói của bạn. Vui lòng kiểm tra micro, nói to và rõ ràng hơn."
          : (parsed.detailed_feedback || "Bạn đã hoàn thành bài luyện nói!"),
        improved_sentence: finalSuggestion,

        // Mapped keys for frontend compatibility
        feedback: (isNoSpeech || finalScore === 0)
          ? "Không nhận diện được giọng nói của bạn. Vui lòng nói to và rõ ràng hơn."
          : (parsed.detailed_feedback || "Bạn đã hoàn thành bài luyện nói!"),
        reply: (isNoSpeech || finalScore === 0)
          ? "Không nhận diện được giọng nói của bạn. Vui lòng kiểm tra micro, nói to và rõ ràng hơn."
          : (parsed.detailed_feedback || "Bạn đã hoàn thành bài luyện nói!"),
        suggestedText: finalSuggestion,
        suggestion: finalSuggestion,
        errors: finalScore < 70 ? [finalGrammarFB] : [],
        words: evaluatedWords
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.evaluateAudio:", error);
      throw new Error("Lỗi hệ thống khi AI xử lý nhận diện và đánh giá âm thanh: " + error.message);
    }
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
  ask: (question, lessonId, userId, scope) => serviceInstance.ask(question, lessonId, userId, scope),
  askStream: (question, lessonId, userId, onChunk, scope) => serviceInstance.askStream(question, lessonId, userId, onChunk, scope),
  generateQuiz: (lessonId) => serviceInstance.generateQuiz(lessonId),
  saveHistory: (userId, lessonId, question, answer) => serviceInstance.saveHistory(userId, lessonId, question, answer),
  getHistory: (userId, lessonId) => serviceInstance.getHistory(userId, lessonId),
  clearHistory: (userId, lessonId) => serviceInstance.clearHistory(userId, lessonId),
  evaluateAudio: (filePath, mimetype, targetText, isQA) => serviceInstance.evaluateAudio(filePath, mimetype, targetText, isQA),
  getTokenBalance: (userId) => serviceInstance.getTokenBalance(userId),
  handleRagChat,
  handleRagChatStream,
  verifyLessonAndCourseAccess,
  retrieveContext
};

