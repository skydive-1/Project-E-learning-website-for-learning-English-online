/**
 * Subtitles Controller - Quản lý API Phụ đề Thông minh Song ngữ
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: Lesson Media Security & Video Captions
 */

const subtitlesService = require('../services/subtitles.service');

/**
 * GET /api/lessons/:lessonId/subtitles - Lấy phụ đề bài học
 */
exports.getSubtitles = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const subtitles = await subtitlesService.getSubtitlesByLessonId(lessonId);

    if (!subtitles) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Bài học chưa có phụ đề'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy phụ đề bài học thành công',
      data: {
        subtitleId: subtitles.subtitle_id,
        lessonId: subtitles.lesson_id,
        enVtt: subtitles.en_vtt,
        viVtt: subtitles.vi_vtt,
        bilingualVtt: subtitles.bilingual_vtt,
        cues: typeof subtitles.cues === 'string' ? JSON.parse(subtitles.cues) : (subtitles.cues || []),
        subtitleStatus: subtitles.subtitle_status || 'ready',
        updatedAt: subtitles.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/lessons/:lessonId/subtitle-status - Poll trạng thái xử lý phụ đề (cho frontend polling)
 */
exports.getSubtitleStatus = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const result = await subtitlesService.getSubtitleStatus(lessonId);
    return res.status(200).json({
      success: true,
      data: {
        lessonId: Number(lessonId),
        status: result.status,   // none | pending | processing | ready | failed
        code: result.code,
        message: result.message,
        updatedAt: result.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/lessons/:lessonId/generate-subtitles - Kích hoạt AI Gemini sinh phụ đề
 */
exports.generateSubtitles = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const subtitles = await subtitlesService.generateSubtitlesWithGemini(lessonId);

    return res.status(200).json({
      success: true,
      message: 'Sinh phụ đề song ngữ bằng AI Gemini thành công',
      data: {
        subtitleId: subtitles.subtitle_id,
        lessonId: subtitles.lesson_id,
        enVtt: subtitles.en_vtt,
        viVtt: subtitles.vi_vtt,
        bilingualVtt: subtitles.bilingual_vtt,
        cues: typeof subtitles.cues === 'string' ? JSON.parse(subtitles.cues) : (subtitles.cues || []),
        updatedAt: subtitles.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

const { ingestLessonTranscript, deleteLessonVectors } = require('../services/ragIngestion.service');

/**
 * PUT /api/lessons/:lessonId/subtitles - Cập nhật phụ đề tùy chỉnh
 */
exports.updateSubtitles = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { en_vtt, vi_vtt, bilingual_vtt, cues } = req.body;

    const subtitles = await subtitlesService.saveSubtitles(lessonId, {
      en_vtt,
      vi_vtt,
      bilingual_vtt,
      cues,
      subtitle_status: 'ready'
    });

    // Đồng bộ transcript và xóa vector cũ nếu phụ đề bị làm rỗng.
    if (cues && Array.isArray(cues) && cues.length > 0) {
      await ingestLessonTranscript(lessonId, cues);
      // Tự động sinh câu hỏi gợi ý khi admin/giảng viên lưu phụ đề
      try {
        const { generateAndSaveSuggestedQuestions } = require('../services/suggestedQuestions.service');
        generateAndSaveSuggestedQuestions(lessonId, cues).catch(err => {
          console.warn(`[Subtitles AI Questions] Lỗi sinh câu hỏi cho lessonId=${lessonId}:`, err.message);
        });
      } catch (_) {}
    } else {
      await deleteLessonVectors(lessonId, 'auto-subtitle-transcript');
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật phụ đề bài học thành công',
      data: subtitles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/lessons/:lessonId/rag-status - Kiểm tra tình trạng dữ liệu RAG của bài học trong Pinecone
 */
exports.getLessonRagStatus = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { pineconeIndex } = require('../../../utils/ai-clients');
    const { getRagIndex, getRagNamespace } = require('../../../utils/ragIndex.util');

    if (!pineconeIndex || typeof pineconeIndex.describeIndexStats !== 'function') {
      const error = new Error('Pinecone chưa được cấu hình hoặc chưa sẵn sàng.');
      error.status = 503;
      error.code = 'RAG_VECTOR_DB_UNAVAILABLE';
      throw error;
    }

    const namespace = getRagNamespace();
    const targetIndex = getRagIndex(pineconeIndex);
    const stats = await targetIndex.describeIndexStats({
      filter: {
        lesson_id: { $eq: Number(lessonId) },
        schema_version: { $eq: 'v2' }
      }
    });
    const chunkCount = Number(
      stats?.namespaces?.[namespace]?.recordCount
      || stats?.namespaces?.['']?.recordCount
      || stats?.totalRecordCount
      || 0
    );
    const hasData = chunkCount > 0;

    return res.status(200).json({
      success: true,
      data: {
        lessonId: Number(lessonId),
        hasData,
        chunkCount
      }
    });
  } catch (error) {
    console.error(`[RAG Status Controller Error] lessonId=${req.params?.lessonId}:`, error.message);
    next(error);
  }
};
