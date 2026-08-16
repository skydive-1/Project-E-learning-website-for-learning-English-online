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
    let subtitles = await subtitlesService.getSubtitlesByLessonId(lessonId);

    // Nếu chưa có phụ đề -> Tự động kích hoạt Gemini sinh nhanh lần đầu
    if (!subtitles) {
      try {
        subtitles = await subtitlesService.generateSubtitlesWithGemini(lessonId);
      } catch (genErr) {
        console.warn(`[Subtitles Controller]: Không thể tự sinh phụ đề cho lesson ${lessonId}:`, genErr.message);
      }
    }

    if (!subtitles) {
      return res.status(200).json({
        success: false,
        data: null,
        message: 'Không thể tự động sinh phụ đề cho bài học này, vui lòng thử lại hoặc liên hệ giảng viên tải phụ đề thủ công'
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
        updatedAt: subtitles.updated_at
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
      message: 'Sinh phụ đề song ngữ bằng AI Gemini 3.7 Flash thành công',
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
    console.error(`[Subtitles Controller]: Lỗi kích hoạt sinh phụ đề cho lesson ${req.params?.lessonId}:`, error.message);
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message || 'Không thể tự động sinh phụ đề cho bài học này, vui lòng thử lại hoặc liên hệ giảng viên tải phụ đề thủ công'
    });
  }
};

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
      cues
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật phụ đề bài học thành công',
      data: subtitles
    });
  } catch (error) {
    next(error);
  }
};
