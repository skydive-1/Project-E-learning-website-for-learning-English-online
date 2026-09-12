import apiClient from '../../../config/api.config';

export const getCourseTranscriptHealth = async () => {
  const response = await apiClient.get('/admin/course-transcripts');
  if (!response.data?.success || !response.data?.data) {
    throw new Error('Phản hồi sức khỏe transcript không đúng định dạng.');
  }
  return response.data.data;
};

export const recoverPendingTranscripts = async ({
  courseId = null,
  lessonIds = [],
  limit = 10,
  includeFailed = false
} = {}) => {
  const response = await apiClient.post('/admin/course-transcripts/recover', {
    courseId,
    lessonIds,
    limit,
    includeFailed
  });
  if (!response.data?.success || !response.data?.data) {
    throw new Error('Phản hồi khôi phục transcript không đúng định dạng.');
  }
  return response.data;
};
