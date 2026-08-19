/**
 * PDF Highlight & Personal Notes Controller (TASK-PDF-SMART-NOTES-01-R1 & TASK-PDF-SMART-NOTES-02)
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 */

const pdfNotesService = require('../services/pdfNotes.service');
const coursesService = require('../../courses/services/courses.service');

class PdfNotesController {
  /**
   * GET /api/lessons/:lessonId/pdf-notes
   */
  async getNotes(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const roleId = req.user?.roleId || req.user?.role_id || req.user?.role;
      const { lessonId } = req.params;
      const { materialId, documentRef, page } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để truy cập ghi chú.'
        });
      }

      if (!/^\d+$/.test(String(lessonId).trim())) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'lessonId không hợp lệ.'
        });
      }

      // Kiểm tra quyền truy cập bài học
      const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, roleId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập bài học này.'
        });
      }

      const notes = await pdfNotesService.getNotes({
        userId,
        lessonId,
        materialId,
        pageNumber: page
      });

      return res.status(200).json({
        success: true,
        data: notes,
        total: notes.length
      });
    } catch (error) {
      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'BAD_REQUEST',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/lessons/:lessonId/pdf-notes
   */
  async createNote(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const roleId = req.user?.roleId || req.user?.role_id || req.user?.role;
      const { lessonId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để tạo ghi chú.'
        });
      }

      if (!/^\d+$/.test(String(lessonId).trim())) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'lessonId không hợp lệ.'
        });
      }

      const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, roleId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập bài học này.'
        });
      }

      const {
        materialId,
        documentRef,
        pageNumber,
        selectionType = 'text',
        selectedText,
        noteText,
        category,
        color,
        rects,
        contextBefore,
        contextAfter
      } = req.body;

      if (!pageNumber || !rects) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Vui lòng cung cấp đầy đủ pageNumber và rects.'
        });
      }

      const cleanSelectionType = String(selectionType || 'text').toLowerCase().trim();
      if (cleanSelectionType === 'text' && (!selectedText || !String(selectedText).trim())) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Ghi chú văn bản (text note) bắt buộc phải có selectedText.'
        });
      }

      if (cleanSelectionType === 'area' && (!noteText || !String(noteText).trim())) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Ghi chú vùng (area note) bắt buộc phải có nội dung noteText.'
        });
      }

      const note = await pdfNotesService.createNote({
        userId,
        lessonId,
        materialId,
        documentRef,
        pageNumber,
        selectionType: cleanSelectionType,
        selectedText,
        noteText,
        category,
        color,
        rects,
        contextBefore,
        contextAfter
      });

      return res.status(201).json({
        success: true,
        message: 'Tạo ghi chú thành công.',
        data: note
      });
    } catch (error) {
      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'BAD_REQUEST',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/lessons/:lessonId/pdf-notes/:noteId
   */
  async updateNote(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const roleId = req.user?.roleId || req.user?.role_id || req.user?.role;
      const { lessonId, noteId } = req.params;
      const { noteText, category, color } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để chỉnh sửa ghi chú.'
        });
      }

      if (!/^\d+$/.test(String(lessonId).trim()) || !/^\d+$/.test(String(noteId).trim())) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'lessonId hoặc noteId không hợp lệ.'
        });
      }

      const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, roleId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập bài học này.'
        });
      }

      const updated = await pdfNotesService.updateNote({
        noteId,
        userId,
        lessonId,
        noteText,
        category,
        color
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          code: 'NOTE_NOT_FOUND',
          message: 'Không tìm thấy ghi chú hoặc ghi chú không thuộc quyền sở hữu của bạn trong bài học này.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Cập nhật ghi chú thành công.',
        data: updated
      });
    } catch (error) {
      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'BAD_REQUEST',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/lessons/:lessonId/pdf-notes/:noteId
   */
  async deleteNote(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const roleId = req.user?.roleId || req.user?.role_id || req.user?.role;
      const { lessonId, noteId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để xóa ghi chú.'
        });
      }

      if (!/^\d+$/.test(String(lessonId).trim()) || !/^\d+$/.test(String(noteId).trim())) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAM',
          message: 'lessonId hoặc noteId không hợp lệ.'
        });
      }

      const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, roleId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập bài học này.'
        });
      }

      const deleted = await pdfNotesService.deleteNote(noteId, userId, lessonId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          code: 'NOTE_NOT_FOUND',
          message: 'Không tìm thấy ghi chú hoặc bạn không có quyền xóa ghi chú này trong bài học này.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Xóa ghi chú thành công.'
      });
    } catch (error) {
      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'BAD_REQUEST',
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = new PdfNotesController();
