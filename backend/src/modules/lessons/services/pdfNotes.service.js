/**
 * PDF Highlight & Personal Notes Service (TASK-PDF-SMART-NOTES-01)
 *
 * Quản lý ghi chú cá nhân và highlight trên tài liệu PDF:
 * - Lưu trữ tọa độ chuẩn hóa (Normalized Rects 0-1) chống lệch khi zoom/responsive.
 * - Cô lập dữ liệu cá nhân 100% (Strict User Isolation theo user_id).
 * - Xác thực định dạng, giới hạn độ dài chuỗi và whitelist danh mục/màu sắc.
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 */

const db = require('../../../config/database');

const ALLOWED_CATEGORIES = ['important', 'not_understood', 'review', 'vocabulary'];
const ALLOWED_COLORS = ['yellow', 'green', 'blue', 'pink'];

/**
 * Kiểm tra tính hợp lệ của mảng rects chuẩn hóa (0.0 <= val <= 1.0)
 */
function validateNormalizedRects(rects) {
  if (!Array.isArray(rects) || rects.length === 0) {
    throw new Error('Danh sách vùng chọn rects phải là một mảng không rỗng.');
  }

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (typeof r !== 'object' || r === null) {
      throw new Error(`Rect tại chỉ mục ${i} không phải là object hợp lệ.`);
    }

    const { x, y, width, height } = r;
    const values = [x, y, width, height];
    const names = ['x', 'y', 'width', 'height'];

    for (let j = 0; j < 4; j++) {
      const val = values[j];
      const name = names[j];
      if (typeof val !== 'number' || !Number.isFinite(val) || isNaN(val)) {
        throw new Error(`Tọa độ '${name}' tại rect ${i} phải là số hữu hạn.`);
      }
      if (val < 0 || val > 1) {
        throw new Error(`Tọa độ '${name}' (${val}) tại rect ${i} phải nằm trong khoảng chuẩn hóa [0.0, 1.0].`);
      }
    }

    if (width <= 0 || height <= 0) {
      throw new Error(`Kích thước width/height tại rect ${i} phải lớn hơn 0.`);
    }
  }

  return true;
}

class PdfNotesService {
  /**
   * Lấy danh sách ghi chú của người dùng cho bài học
   */
  async getNotes({ userId, lessonId, documentRef, pageNumber }) {
    const parsedUserId = parseInt(userId, 10);
    const parsedLessonId = parseInt(lessonId, 10);

    if (isNaN(parsedUserId) || isNaN(parsedLessonId)) {
      throw new Error('userId và lessonId không hợp lệ.');
    }

    let query = `
      SELECT 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selected_text AS "selectedText",
        note_text AS "noteText",
        category,
        color,
        rects,
        context_before AS "contextBefore",
        context_after AS "contextAfter",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM pdf_notes
      WHERE user_id = $1 AND lesson_id = $2
    `;

    const params = [parsedUserId, parsedLessonId];
    let paramIndex = 3;

    if (documentRef && typeof documentRef === 'string' && documentRef.trim()) {
      query += ` AND document_ref = $${paramIndex}`;
      params.push(documentRef.trim());
      paramIndex++;
    }

    if (pageNumber !== undefined && pageNumber !== null) {
      const parsedPage = parseInt(pageNumber, 10);
      if (!isNaN(parsedPage) && parsedPage >= 1) {
        query += ` AND page_number = $${paramIndex}`;
        params.push(parsedPage);
        paramIndex++;
      }
    }

    query += ` ORDER BY page_number ASC, created_at ASC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Lấy chi tiết một ghi chú theo noteId và userId
   */
  async getNoteById(noteId, userId) {
    const parsedNoteId = parseInt(noteId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (isNaN(parsedNoteId) || isNaN(parsedUserId)) {
      return null;
    }

    const query = `
      SELECT 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selected_text AS "selectedText",
        note_text AS "noteText",
        category,
        color,
        rects,
        context_before AS "contextBefore",
        context_after AS "contextAfter",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM pdf_notes
      WHERE note_id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [parsedNoteId, parsedUserId]);
    return result.rows[0] || null;
  }

  /**
   * Tạo mới một ghi chú & highlight PDF
   */
  async createNote({
    userId,
    lessonId,
    materialId = null,
    documentRef,
    pageNumber,
    selectedText,
    noteText = '',
    category = 'important',
    color = 'yellow',
    rects,
    contextBefore = '',
    contextAfter = ''
  }) {
    const parsedUserId = parseInt(userId, 10);
    const parsedLessonId = parseInt(lessonId, 10);
    const parsedMaterialId = materialId ? parseInt(materialId, 10) : null;
    const parsedPageNumber = parseInt(pageNumber, 10);

    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      throw new Error('userId không hợp lệ.');
    }
    if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
      throw new Error('lessonId không hợp lệ.');
    }
    if (isNaN(parsedPageNumber) || parsedPageNumber < 1) {
      throw new Error('pageNumber phải là số nguyên dương từ 1 trở lên.');
    }

    if (!selectedText || typeof selectedText !== 'string' || !selectedText.trim()) {
      throw new Error('selectedText không được để trống.');
    }
    if (selectedText.length > 5000) {
      throw new Error('selectedText vượt quá độ dài tối đa 5000 ký tự.');
    }

    const cleanNoteText = typeof noteText === 'string' ? noteText.trim() : '';
    if (cleanNoteText.length > 2000) {
      throw new Error('noteText vượt quá độ dài tối đa 2000 ký tự.');
    }

    const cleanCategory = String(category).toLowerCase().trim();
    if (!ALLOWED_CATEGORIES.includes(cleanCategory)) {
      throw new Error(`category không hợp lệ. Phải thuộc: ${ALLOWED_CATEGORIES.join(', ')}.`);
    }

    const cleanColor = String(color).toLowerCase().trim();
    if (!ALLOWED_COLORS.includes(cleanColor)) {
      throw new Error(`color không hợp lệ. Phải thuộc: ${ALLOWED_COLORS.join(', ')}.`);
    }

    const cleanDocRef = documentRef && typeof documentRef === 'string' && documentRef.trim()
      ? documentRef.trim()
      : (parsedMaterialId ? `lesson:${parsedLessonId}:material:${parsedMaterialId}` : `lesson:${parsedLessonId}:primary`);

    // Validate rects
    validateNormalizedRects(rects);

    const query = `
      INSERT INTO pdf_notes (
        user_id,
        lesson_id,
        material_id,
        document_ref,
        page_number,
        selected_text,
        note_text,
        category,
        color,
        rects,
        context_before,
        context_after,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selected_text AS "selectedText",
        note_text AS "noteText",
        category,
        color,
        rects,
        context_before AS "contextBefore",
        context_after AS "contextAfter",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const values = [
      parsedUserId,
      parsedLessonId,
      parsedMaterialId,
      cleanDocRef,
      parsedPageNumber,
      selectedText.trim(),
      cleanNoteText,
      cleanCategory,
      cleanColor,
      JSON.stringify(rects),
      typeof contextBefore === 'string' ? contextBefore.slice(0, 500) : '',
      typeof contextAfter === 'string' ? contextAfter.slice(0, 500) : ''
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Cập nhật nội dung ghi chú, loại ghi chú hoặc màu sắc
   */
  async updateNote({ noteId, userId, noteText, category, color }) {
    const parsedNoteId = parseInt(noteId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (isNaN(parsedNoteId) || isNaN(parsedUserId)) {
      throw new Error('noteId hoặc userId không hợp lệ.');
    }

    // Kiểm tra quyền sở hữu ghi chú
    const existing = await this.getNoteById(parsedNoteId, parsedUserId);
    if (!existing) {
      return null;
    }

    const updates = [];
    const params = [parsedNoteId, parsedUserId];
    let paramIndex = 3;

    if (noteText !== undefined) {
      if (typeof noteText !== 'string') {
        throw new Error('noteText phải là chuỗi ký tự.');
      }
      if (noteText.length > 2000) {
        throw new Error('noteText vượt quá độ dài tối đa 2000 ký tự.');
      }
      updates.push(`note_text = $${paramIndex}`);
      params.push(noteText.trim());
      paramIndex++;
    }

    if (category !== undefined) {
      const cleanCategory = String(category).toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(cleanCategory)) {
        throw new Error(`category không hợp lệ. Phải thuộc: ${ALLOWED_CATEGORIES.join(', ')}.`);
      }
      updates.push(`category = $${paramIndex}`);
      params.push(cleanCategory);
      paramIndex++;
    }

    if (color !== undefined) {
      const cleanColor = String(color).toLowerCase().trim();
      if (!ALLOWED_COLORS.includes(cleanColor)) {
        throw new Error(`color không hợp lệ. Phải thuộc: ${ALLOWED_COLORS.join(', ')}.`);
      }
      updates.push(`color = $${paramIndex}`);
      params.push(cleanColor);
      paramIndex++;
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE pdf_notes
      SET ${updates.join(', ')}
      WHERE note_id = $1 AND user_id = $2
      RETURNING 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selected_text AS "selectedText",
        note_text AS "noteText",
        category,
        color,
        rects,
        context_before AS "contextBefore",
        context_after AS "contextAfter",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Xóa ghi chú (Chỉ người sở hữu mới được xóa)
   */
  async deleteNote(noteId, userId) {
    const parsedNoteId = parseInt(noteId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (isNaN(parsedNoteId) || isNaN(parsedUserId)) {
      throw new Error('noteId hoặc userId không hợp lệ.');
    }

    const query = `
      DELETE FROM pdf_notes
      WHERE note_id = $1 AND user_id = $2
      RETURNING note_id
    `;

    const result = await db.query(query, [parsedNoteId, parsedUserId]);
    return result.rowCount > 0;
  }
}

module.exports = new PdfNotesService();
