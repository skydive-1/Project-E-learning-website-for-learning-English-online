/**
 * Comments Service - API client quản lý thảo luận & bình luận bài học
 */
import apiClient from '../../../config/api.config';

/**
 * Lấy danh sách bình luận của bài học (Threaded comments)
 * @param {number|string} lessonId 
 * @returns {Promise<Array>}
 */
export const getLessonComments = async (lessonId) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.get(`/comments/lesson/${cleanId}`);
  return response.data?.comments || [];
};

/**
 * Đăng bình luận mới hoặc phản hồi bình luận
 * @param {number|string} lessonId 
 * @param {Object} data { content: string, parentId?: number }
 * @returns {Promise<Object>}
 */
export const createComment = async (lessonId, { content, parentId = null }) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.post(`/comments/lesson/${cleanId}`, {
    content,
    parentId
  });
  return response.data?.comment;
};

/**
 * Chỉnh sửa nội dung bình luận
 * @param {number|string} commentId 
 * @param {string} content 
 * @returns {Promise<Object>}
 */
export const updateComment = async (commentId, content) => {
  const response = await apiClient.put(`/comments/${commentId}`, { content });
  return response.data?.comment;
};

/**
 * Xóa bình luận
 * @param {number|string} commentId 
 * @returns {Promise<Object>}
 */
export const deleteComment = async (commentId) => {
  const response = await apiClient.delete(`/comments/${commentId}`);
  return response.data;
};

/**
 * Thả tim / Upvote hoặc bỏ upvote bình luận (Toggle)
 * @param {number|string} commentId 
 * @returns {Promise<{ upvoted: boolean, upvotesCount: number }>}
 */
export const toggleUpvoteComment = async (commentId) => {
  const response = await apiClient.post(`/comments/${commentId}/upvote`);
  return response.data;
};

/**
 * Ghim hoặc bỏ ghim bình luận (Dành cho Giảng viên / Admin)
 * @param {number|string} commentId 
 * @returns {Promise<{ isPinned: boolean }>}
 */
export const togglePinComment = async (commentId) => {
  const response = await apiClient.put(`/comments/${commentId}/pin`);
  return response.data;
};
