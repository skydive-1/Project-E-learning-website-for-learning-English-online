/**
 * PDF Highlight & Personal Notes Service (TASK-PDF-SMART-NOTES-01-R1 & TASK-PDF-SMART-NOTES-02)
 *
 * Quản lý ghi chú cá nhân và highlight trên tài liệu PDF:
 * - Hỗ trợ cả 2 chế độ:
 *   1. selection_type = 'text': Bôi đen văn bản trên PDF có text layer.
 *   2. selection_type = 'area': Khoanh vùng ảnh/nội dung trên PDF scan/infographic.
 * - Lưu trữ tọa độ chuẩn hóa (Normalized Rects 0-1) chống lệch khi zoom/responsive.
 * - Cô lập dữ liệu cá nhân nghiêm ngặt (user_id + lesson_id + note_id).
 * - Xác thực định danh tài liệu do Server quản lý và phiên bản tài liệu (documentRef v1, v2...).
 * - Xác thực vật liệu đính kèm (materialId) thuộc đúng bài học.
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 */

const db = require('../../../config/database');

const ALLOWED_CATEGORIES = ['important', 'not_understood', 'review', 'vocabulary'];
const ALLOWED_COLORS = ['yellow', 'green', 'blue', 'pink'];
const ALLOWED_SELECTION_TYPES = ['text', 'area'];

/**
 * Kiểm tra và chuyển đổi số nguyên dương nghiêm ngặt (không chấp nhận '1abc', <= 0, NaN)
 */
function parsePositiveInt(val, fieldName) {
  if (val === undefined || val === null || val === '') {
    const err = new Error(`Trường '${fieldName}' không được để trống.`);
    err.status = 400;
    err.code = 'INVALID_PARAM';
    throw err;
  }

  const str = String(val).trim();
  if (!/^\d+$/.test(str)) {
    const err = new Error(`Trường '${fieldName}' phải là số nguyên dương hợp lệ (nhận: '${val}').`);
    err.status = 400;
    err.code = 'INVALID_PARAM';
    throw err;
  }

  const num = parseInt(str, 10);
  if (num <= 0 || !Number.isSafeInteger(num)) {
    const err = new Error(`Trường '${fieldName}' phải là số nguyên dương lớn hơn 0.`);
    err.status = 400;
    err.code = 'INVALID_PARAM';
    throw err;
  }

  return num;
}

/**
 * Kiểm tra tính hợp lệ của mảng rects chuẩn hóa (0.0 <= val <= 1.0)
 * Bắt buộc: x >= 0, y >= 0, width > 0, height > 0, x + width <= 1, y + height <= 1
 */
function validateNormalizedRects(rects) {
  if (!Array.isArray(rects) || rects.length === 0) {
    const err = new Error('Danh sách vùng chọn rects phải là một mảng không rỗng.');
    err.status = 400;
    err.code = 'INVALID_RECTS';
    throw err;
  }

  if (rects.length > 50) {
    const err = new Error('Số lượng vùng chọn rects không được vượt quá 50 ô.');
    err.status = 400;
    err.code = 'TOO_MANY_RECTS';
    throw err;
  }

  const EPSILON = 0.0001; // Bù sai số số thực JavaScript

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (typeof r !== 'object' || r === null) {
      const err = new Error(`Rect tại chỉ mục ${i} không phải là object hợp lệ.`);
      err.status = 400;
      err.code = 'INVALID_RECTS';
      throw err;
    }

    const { x, y, width, height } = r;
    const values = [x, y, width, height];
    const names = ['x', 'y', 'width', 'height'];

    for (let j = 0; j < 4; j++) {
      const val = values[j];
      const name = names[j];
      if (typeof val !== 'number' || !Number.isFinite(val) || isNaN(val)) {
        const err = new Error(`Tọa độ '${name}' tại rect ${i} phải là số hữu hạn.`);
        err.status = 400;
        err.code = 'INVALID_RECTS';
        throw err;
      }
      if (val < 0 || val > 1) {
        const err = new Error(`Tọa độ '${name}' (${val}) tại rect ${i} phải nằm trong khoảng chuẩn hóa [0.0, 1.0].`);
        err.status = 400;
        err.code = 'INVALID_RECTS';
        throw err;
      }
    }

    if (width <= 0 || height <= 0) {
      const err = new Error(`Kích thước width và height tại rect ${i} phải lớn hơn 0.`);
      err.status = 400;
      err.code = 'INVALID_RECTS';
      throw err;
    }

    // Kiểm tra kích thước tối thiểu để loại bỏ click vô tình
    if (width < 0.001 || height < 0.001) {
      const err = new Error(`Vùng chọn rect ${i} quá nhỏ, vui lòng khoanh vùng rõ ràng hơn.`);
      err.status = 400;
      err.code = 'INVALID_RECTS';
      throw err;
    }

    if (x + width > 1.0 + EPSILON) {
      const err = new Error(`Vùng chọn rect ${i} vượt quá giới hạn chiều ngang của trang (x + width = ${(x + width).toFixed(4)} > 1.0).`);
      err.status = 400;
      err.code = 'INVALID_RECTS';
      throw err;
    }

    if (y + height > 1.0 + EPSILON) {
      const err = new Error(`Vùng chọn rect ${i} vượt quá giới hạn chiều dọc của trang (y + height = ${(y + height).toFixed(4)} > 1.0).`);
      err.status = 400;
      err.code = 'INVALID_RECTS';
      throw err;
    }
  }

  return true;
}

class PdfNotesService {
  /**
   * Xác định định danh phiên bản tài liệu do Server quản lý
   * Không tin tưởng chuỗi documentRef tùy tiện từ frontend
   */
  async resolveDocumentRef(lessonId, materialId = null) {
    const parsedLessonId = parsePositiveInt(lessonId, 'lessonId');

    if (materialId !== undefined && materialId !== null && String(materialId).trim() !== '') {
      const parsedMaterialId = parsePositiveInt(materialId, 'materialId');
      const matResult = await db.query(
        'SELECT material_id, lesson_id, COALESCE(pdf_version, 1) AS pdf_version FROM lesson_materials WHERE material_id = $1',
        [parsedMaterialId]
      );

      const material = matResult.rows[0];
      if (!material || Number(material.lesson_id) !== parsedLessonId) {
        const err = new Error('Tài liệu đính kèm (materialId) không tồn tại hoặc không thuộc bài học này.');
        err.status = 400;
        err.code = 'INVALID_MATERIAL';
        throw err;
      }

      return {
        materialId: parsedMaterialId,
        documentRef: `lesson:${parsedLessonId}:material:${parsedMaterialId}:v${material.pdf_version || 1}`,
        pdfVersion: material.pdf_version || 1
      };
    }

    // PDF chính của bài học
    const lessonResult = await db.query(
      'SELECT lesson_id, content_type, COALESCE(pdf_version, 1) AS pdf_version FROM lessons WHERE lesson_id = $1',
      [parsedLessonId]
    );

    const lesson = lessonResult.rows[0];
    if (!lesson) {
      const err = new Error('Bài học không tồn tại.');
      err.status = 404;
      err.code = 'LESSON_NOT_FOUND';
      throw err;
    }

    const version = lesson.pdf_version || 1;
    return {
      materialId: null,
      documentRef: `lesson:${parsedLessonId}:primary:v${version}`,
      pdfVersion: version
    };
  }

  /**
   * Lấy danh sách ghi chú của người dùng cho bài học
   */
  async getNotes({ userId, lessonId, materialId, documentRef, pageNumber }) {
    const parsedUserId = parsePositiveInt(userId, 'userId');
    const parsedLessonId = parsePositiveInt(lessonId, 'lessonId');

    // Xác định phiên bản tài liệu hiện tại từ Server nếu không truyền documentRef cụ thể
    let targetDocRef = documentRef && typeof documentRef === 'string' ? documentRef.trim() : null;
    if (!targetDocRef) {
      const resolved = await this.resolveDocumentRef(parsedLessonId, materialId);
      targetDocRef = resolved.documentRef;
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
        selection_type AS "selectionType",
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

    if (targetDocRef) {
      // Hỗ trợ tương thích ngược: Nếu targetDocRef là v1 (ví dụ lesson:25:primary:v1),
      // thì chấp nhận cả legacy format lesson:25:primary
      const isV1 = targetDocRef.endsWith(':v1');
      if (isV1) {
        const legacyDocRef = targetDocRef.replace(/:v1$/, '');
        query += ` AND (document_ref = $${paramIndex} OR document_ref = $${paramIndex + 1})`;
        params.push(targetDocRef, legacyDocRef);
        paramIndex += 2;
      } else {
        query += ` AND document_ref = $${paramIndex}`;
        params.push(targetDocRef);
        paramIndex++;
      }
    }

    if (pageNumber !== undefined && pageNumber !== null && String(pageNumber).trim() !== '') {
      const parsedPage = parsePositiveInt(pageNumber, 'pageNumber');
      query += ` AND page_number = $${paramIndex}`;
      params.push(parsedPage);
      paramIndex++;
    }

    query += ` ORDER BY page_number ASC, created_at ASC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Lấy chi tiết một ghi chú theo noteId, userId và lessonId
   */
  async getNoteById(noteId, userId, lessonId) {
    const parsedNoteId = parsePositiveInt(noteId, 'noteId');
    const parsedUserId = parsePositiveInt(userId, 'userId');
    const parsedLessonId = parsePositiveInt(lessonId, 'lessonId');

    const query = `
      SELECT 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selection_type AS "selectionType",
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
      WHERE note_id = $1 AND user_id = $2 AND lesson_id = $3
    `;

    const result = await db.query(query, [parsedNoteId, parsedUserId, parsedLessonId]);
    return result.rows[0] || null;
  }

  /**
   * Tạo mới một ghi chú & highlight PDF (hỗ trợ text & area)
   */
  async createNote({
    userId,
    lessonId,
    materialId = null,
    documentRef,
    pageNumber,
    selectionType = 'text',
    selectedText = null,
    noteText = '',
    category = 'important',
    color = 'yellow',
    rects,
    contextBefore = '',
    contextAfter = ''
  }) {
    const parsedUserId = parsePositiveInt(userId, 'userId');
    const parsedLessonId = parsePositiveInt(lessonId, 'lessonId');
    const parsedPageNumber = parsePositiveInt(pageNumber, 'pageNumber');

    // Xác thực selectionType
    const cleanSelectionType = String(selectionType || 'text').toLowerCase().trim();
    if (!ALLOWED_SELECTION_TYPES.includes(cleanSelectionType)) {
      const err = new Error(`selectionType không hợp lệ. Phải thuộc: ${ALLOWED_SELECTION_TYPES.join(', ')}.`);
      err.status = 400;
      err.code = 'INVALID_SELECTION_TYPE';
      throw err;
    }

    // Xác thực tài liệu và sinh documentRef an toàn từ server
    const resolvedDoc = await this.resolveDocumentRef(parsedLessonId, materialId);
    const serverDocRef = resolvedDoc.documentRef;
    const resolvedMaterialId = resolvedDoc.materialId;

    const cleanNoteText = typeof noteText === 'string' ? noteText.trim() : '';
    if (cleanNoteText.length > 2000) {
      const err = new Error('noteText vượt quá độ dài tối đa 2000 ký tự.');
      err.status = 400;
      err.code = 'NOTE_TOO_LONG';
      throw err;
    }

    let finalSelectedText = null;

    if (cleanSelectionType === 'text') {
      if (!selectedText || typeof selectedText !== 'string' || !selectedText.trim()) {
        const err = new Error('selectedText không được để trống đối với ghi chú văn bản.');
        err.status = 400;
        err.code = 'INVALID_TEXT';
        throw err;
      }
      if (selectedText.length > 5000) {
        const err = new Error('selectedText vượt quá độ dài tối đa 5000 ký tự.');
        err.status = 400;
        err.code = 'TEXT_TOO_LONG';
        throw err;
      }
      finalSelectedText = selectedText.trim();
    } else {
      // selectionType === 'area'
      if (!cleanNoteText) {
        const err = new Error('noteText không được để trống đối với ghi chú vùng (area note).');
        err.status = 400;
        err.code = 'INVALID_NOTE_TEXT';
        throw err;
      }
      // Với area note, selectedText có thể là null hoặc chuỗi tóm tắt nếu có
      finalSelectedText = selectedText && typeof selectedText === 'string' && selectedText.trim() ? selectedText.trim() : null;
    }

    const cleanCategory = String(category).toLowerCase().trim();
    if (!ALLOWED_CATEGORIES.includes(cleanCategory)) {
      const err = new Error(`category không hợp lệ. Phải thuộc: ${ALLOWED_CATEGORIES.join(', ')}.`);
      err.status = 400;
      err.code = 'INVALID_CATEGORY';
      throw err;
    }

    const cleanColor = String(color).toLowerCase().trim();
    if (!ALLOWED_COLORS.includes(cleanColor)) {
      const err = new Error(`color không hợp lệ. Phải thuộc: ${ALLOWED_COLORS.join(', ')}.`);
      err.status = 400;
      err.code = 'INVALID_COLOR';
      throw err;
    }

    // Validate rects
    validateNormalizedRects(rects);

    const query = `
      INSERT INTO pdf_notes (
        user_id,
        lesson_id,
        material_id,
        document_ref,
        page_number,
        selection_type,
        selected_text,
        note_text,
        category,
        color,
        rects,
        context_before,
        context_after,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selection_type AS "selectionType",
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
      resolvedMaterialId,
      serverDocRef,
      parsedPageNumber,
      cleanSelectionType,
      finalSelectedText,
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
   * Bắt buộc kiểm tra đồng thời noteId + userId + lessonId
   */
  async updateNote({ noteId, userId, lessonId, noteText, category, color }) {
    const parsedNoteId = parsePositiveInt(noteId, 'noteId');
    const parsedUserId = parsePositiveInt(userId, 'userId');
    const parsedLessonId = parsePositiveInt(lessonId, 'lessonId');

    // Kiểm tra quyền sở hữu ghi chú gắn liền với bài học
    const existing = await this.getNoteById(parsedNoteId, parsedUserId, parsedLessonId);
    if (!existing) {
      return null;
    }

    const updates = [];
    const params = [parsedNoteId, parsedUserId, parsedLessonId];
    let paramIndex = 4;

    if (noteText !== undefined) {
      if (typeof noteText !== 'string') {
        const err = new Error('noteText phải là chuỗi ký tự.');
        err.status = 400;
        err.code = 'INVALID_PARAM';
        throw err;
      }
      if (noteText.length > 2000) {
        const err = new Error('noteText vượt quá độ dài tối đa 2000 ký tự.');
        err.status = 400;
        err.code = 'NOTE_TOO_LONG';
        throw err;
      }
      if (existing.selectionType === 'area' && !noteText.trim()) {
        const err = new Error('noteText không được để trống đối với ghi chú vùng (area note).');
        err.status = 400;
        err.code = 'INVALID_NOTE_TEXT';
        throw err;
      }
      updates.push(`note_text = $${paramIndex}`);
      params.push(noteText.trim());
      paramIndex++;
    }

    if (category !== undefined) {
      const cleanCategory = String(category).toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(cleanCategory)) {
        const err = new Error(`category không hợp lệ. Phải thuộc: ${ALLOWED_CATEGORIES.join(', ')}.`);
        err.status = 400;
        err.code = 'INVALID_CATEGORY';
        throw err;
      }
      updates.push(`category = $${paramIndex}`);
      params.push(cleanCategory);
      paramIndex++;
    }

    if (color !== undefined) {
      const cleanColor = String(color).toLowerCase().trim();
      if (!ALLOWED_COLORS.includes(cleanColor)) {
        const err = new Error(`color không hợp lệ. Phải thuộc: ${ALLOWED_COLORS.join(', ')}.`);
        err.status = 400;
        err.code = 'INVALID_COLOR';
        throw err;
      }
      updates.push(`color = $${paramIndex}`);
      params.push(cleanColor);
      paramIndex++;
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE pdf_notes
      SET ${updates.join(', ')}
      WHERE note_id = $1 AND user_id = $2 AND lesson_id = $3
      RETURNING 
        note_id AS "id",
        note_id AS "noteId",
        user_id AS "userId",
        lesson_id AS "lessonId",
        material_id AS "materialId",
        document_ref AS "documentRef",
        page_number AS "pageNumber",
        selection_type AS "selectionType",
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
    return result.rows[0] || null;
  }

  /**
   * Xóa một ghi chú PDF
   * Bắt buộc kiểm tra đồng thời noteId + userId + lessonId
   */
  async deleteNote(noteId, userId, lessonId) {
    const parsedNoteId = parsePositiveInt(noteId, 'noteId');
    const parsedUserId = parsePositiveInt(userId, 'userId');
    const parsedLessonId = parsePositiveInt(lessonId, 'lessonId');

    const query = `
      DELETE FROM pdf_notes
      WHERE note_id = $1 AND user_id = $2 AND lesson_id = $3
      RETURNING note_id
    `;

    const result = await db.query(query, [parsedNoteId, parsedUserId, parsedLessonId]);
    return result.rowCount > 0;
  }
}

module.exports = new PdfNotesService();
