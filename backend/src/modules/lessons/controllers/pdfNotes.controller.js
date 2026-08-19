/**
 * PDF Highlight & Personal Notes Controller (TASK-PDF-SMART-NOTES-01)
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
      const roleId = req.user?.roleId || req.user?.role;
      const { lessonId } = req.params;
      const { documentRef, page } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để truy cập ghi chú.'
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
        documentRef,
        pageNumber: page
      });

      return res.status(200).json({
        success: true,
        data: notes,
        total: notes.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/lessons/:lessonId/pdf-notes
   */
  async createNote(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const roleId = req.user?.roleId || req.user?.role;
      const { lessonId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để tạo ghi chú.'
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
        selectedText,
        noteText,
        category,
        color,
        rects,
        contextBefore,
        contextAfter
      } = req.body;

      // Basic parameter validations
      if (!pageNumber || !selectedText || !rects) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Vui lòng cung cấp đầy đủ pageNumber, selectedText và rects.'
        });
      }

      try {
        const note = await pdfNotesService.createNote({
          userId,
          lessonId,
          materialId,
          documentRef,
          pageNumber,
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
      } catch (valErr) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_NOTE_DATA',
          message: valErr.message
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/lessons/:lessonId/pdf-notes/:noteId
   */
  async updateNote(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const { noteId } = req.params;
      const { noteText, category, color } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập.'
        });
      }

      try {
        const updated = await pdfNotesService.updateNote({
          noteId,
          userId,
          noteText,
          category,
          color
        });

        if (!updated) {
          return res.status(404).json({
            success: false,
            code: 'NOTE_NOT_FOUND',
            message: 'Ghi chú không tồn tại hoặc bạn không có quyền chỉnh sửa.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Cập nhật ghi chú thành công.',
          data: updated
        });
      } catch (valErr) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_UPDATE_DATA',
          message: valErr.message
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/lessons/:lessonId/pdf-notes/:noteId
   */
  async deleteNote(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const { noteId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập.'
        });
      }

      const deleted = await pdfNotesService.deleteNote(noteId, userId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          code: 'NOTE_NOT_FOUND',
          message: 'Ghi chú không tồn tại hoặc bạn không có quyền xóa.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Đã xóa ghi chú thành công.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PdfNotesController();
