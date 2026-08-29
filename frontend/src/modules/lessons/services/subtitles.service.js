/**
 * Subtitles Frontend Service - Kết nối API Phụ đề AI & Kịch bản Song ngữ
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Lead)
 */

import apiClient from '../../../config/api.config';

class SubtitlesService {
  /**
   * Lấy dữ liệu phụ đề và kịch bản bài học (WebVTT + Cues + Status)
   */
  async getSubtitles(lessonId) {
    try {
      const response = await apiClient.get(`/lessons/${lessonId}/subtitles`);
      return response.data?.data || null;
    } catch (error) {
      console.warn(`[Subtitles Service]: Không thể tải phụ đề bài học ${lessonId}:`, error?.message);
      return null;
    }
  }

  /**
   * Poll trạng thái xử lý phụ đề nền (none | pending | processing | ready | failed)
   * Dùng cho frontend hiển thị UX indicator khi đang sinh phụ đề background
   */
  async getSubtitleStatus(lessonId) {
    try {
      const response = await apiClient.get(`/lessons/${lessonId}/subtitle-status`);
      return response.data?.data || { status: 'none', updatedAt: null };
    } catch (error) {
      console.warn(`[Subtitles Service]: Không thể lấy trạng thái phụ đề ${lessonId}:`, error?.message);
      return { status: 'none', updatedAt: null };
    }
  }

  /**
   * Kích hoạt Gemini 3.7 Flash sinh phụ đề song ngữ tự động (thủ công — giảng viên/admin)
   */
  async generateSubtitles(lessonId) {
    const response = await apiClient.post(`/lessons/${lessonId}/generate-subtitles`);
    return response.data?.data || null;
  }

  /**
   * Cập nhật phụ đề tùy chỉnh
   */
  async updateSubtitles(lessonId, payload) {
    const response = await apiClient.put(`/lessons/${lessonId}/subtitles`, payload);
    return response.data?.data || null;
  }
}

export const subtitlesService = new SubtitlesService();
