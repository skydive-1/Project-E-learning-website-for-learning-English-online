import apiClient from '../../../config/api.config';

/**
 * Service quản lý PDF Smart Notes & Highlight phía Client (TASK-PDF-SMART-NOTES-01, 02 & 03)
 */

/**
 * Lấy danh sách ghi chú cho bài học / tài liệu đính kèm
 * @param {number|string} lessonId - ID bài học
 * @param {number|null} [materialId=null] - ID tài liệu đính kèm nếu có
 * @param {number|null} [page=null] - Lọc theo trang
 * @returns {Promise<Array>}
 */
export const fetchPdfNotes = async (lessonId, materialId = null, page = null) => {
  const cleanLessonId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const params = {};
  if (materialId) params.materialId = materialId;
  if (page) params.page = page;

  const response = await apiClient.get(`/lessons/${cleanLessonId}/pdf-notes`, { params });
  return response.data?.data || [];
};

/**
 * Tạo mới ghi chú / highlight cho PDF (Hỗ trợ cả text note và area note)
 * @param {number|string} lessonId - ID bài học
 * @param {Object} noteData - Dữ liệu ghi chú
 * @returns {Promise<Object>}
 */
export const createPdfNote = async (lessonId, noteData) => {
  const cleanLessonId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const payload = {
    materialId: noteData.materialId || null,
    pageNumber: noteData.pageNumber,
    selectionType: noteData.selectionType || 'text',
    selectedText: noteData.selectionType === 'area' ? null : noteData.selectedText,
    noteText: noteData.noteText || '',
    category: noteData.category || 'important',
    color: noteData.color || 'yellow',
    rects: noteData.rects || [],
    contextBefore: noteData.contextBefore || '',
    contextAfter: noteData.contextAfter || ''
  };

  const response = await apiClient.post(`/lessons/${cleanLessonId}/pdf-notes`, payload);
  return response.data?.data;
};

/**
 * Cập nhật nội dung / nhãn / màu sắc của ghi chú
 * @param {number|string} lessonId - ID bài học
 * @param {number|string} noteId - ID ghi chú
 * @param {Object} updateData - Dữ liệu cập nhật { noteText, category, color }
 * @returns {Promise<Object>}
 */
export const updatePdfNote = async (lessonId, noteId, updateData) => {
  const cleanLessonId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.put(`/lessons/${cleanLessonId}/pdf-notes/${noteId}`, updateData);
  return response.data?.data;
};

/**
 * Xóa ghi chú cá nhân
 * @param {number|string} lessonId - ID bài học
 * @param {number|string} noteId - ID ghi chú
 * @returns {Promise<Object>}
 */
export const deletePdfNote = async (lessonId, noteId) => {
  const cleanLessonId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.delete(`/lessons/${cleanLessonId}/pdf-notes/${noteId}`);
  return response.data;
};
