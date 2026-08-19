/**
 * PDF Highlight & Personal Notes Frontend Service (TASK-PDF-SMART-NOTES-01)
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 */

import apiClient from '../../../config/api.config';

/**
 * Lấy danh sách ghi chú theo bài học và tài liệu PDF
 * @param {string|number} lessonId 
 * @param {string} documentRef 
 * @param {number} [page] 
 */
export const fetchPdfNotes = async (lessonId, documentRef, page) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const params = {};
  if (documentRef) params.documentRef = documentRef;
  if (page) params.page = page;

  const response = await apiClient.get(`/lessons/${cleanId}/pdf-notes`, { params });
  return response.data?.data || [];
};

/**
 * Tạo mới ghi chú / highlight trên PDF
 * @param {string|number} lessonId 
 * @param {object} noteData 
 */
export const createPdfNote = async (lessonId, noteData) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.post(`/lessons/${cleanId}/pdf-notes`, noteData);
  return response.data?.data;
};

/**
 * Cập nhật nội dung hoặc phân loại ghi chú
 * @param {string|number} lessonId 
 * @param {string|number} noteId 
 * @param {object} updateData 
 */
export const updatePdfNote = async (lessonId, noteId, updateData) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.put(`/lessons/${cleanId}/pdf-notes/${noteId}`, updateData);
  return response.data?.data;
};

/**
 * Xóa một ghi chú
 * @param {string|number} lessonId 
 * @param {string|number} noteId 
 */
export const deletePdfNote = async (lessonId, noteId) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.delete(`/lessons/${cleanId}/pdf-notes/${noteId}`);
  return response.data;
};

/**
 * Lấy bản nháp ghi chú tạm thời từ LocalStorage
 */
export const getLocalDraft = (userId, lessonId, documentRef) => {
  if (!userId || !lessonId) return '';
  try {
    return localStorage.getItem(`pdf_draft_${userId}_${lessonId}_${documentRef || 'primary'}`) || '';
  } catch (e) {
    return '';
  }
};

/**
 * Lưu bản nháp ghi chú tạm thời vào LocalStorage
 */
export const setLocalDraft = (userId, lessonId, documentRef, text) => {
  if (!userId || !lessonId) return;
  try {
    if (text) {
      localStorage.setItem(`pdf_draft_${userId}_${lessonId}_${documentRef || 'primary'}`, text);
    } else {
      localStorage.removeItem(`pdf_draft_${userId}_${lessonId}_${documentRef || 'primary'}`);
    }
  } catch (e) { }
};
