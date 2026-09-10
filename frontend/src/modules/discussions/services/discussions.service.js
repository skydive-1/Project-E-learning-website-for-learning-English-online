import apiClient from '../../../config/api.config';

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const normalizeDiscussion = (discussion) => ({
  ...discussion,
  id: discussion.id,
  courseId: String(discussion.courseId),
  lessonId: String(discussion.lessonId),
  createdAtRaw: discussion.createdAt,
  createdAt: formatDateTime(discussion.createdAt),
  updatedAt: formatDateTime(discussion.updatedAt),
  lastActivityAt: discussion.lastActivityAt,
  replies: (discussion.replies || []).map(reply => ({
    ...reply,
    createdAtRaw: reply.createdAt,
    createdAt: formatDateTime(reply.createdAt)
  }))
});

export const normalizeAnnouncement = (announcement) => ({
  ...announcement,
  id: announcement.id,
  courseId: String(announcement.courseId),
  createdAt: formatDateTime(announcement.createdAt),
  updatedAt: formatDateTime(announcement.updatedAt)
});

const readDiscussion = response => normalizeDiscussion(response.data.data.discussion);

export const getStudentLessonDiscussions = async lessonId => {
  const response = await apiClient.get(`/discussions/lesson/${lessonId}`);
  const data = response.data.data;
  return {
    ...data,
    discussions: (data.discussions || []).map(normalizeDiscussion),
    announcements: (data.announcements || []).map(normalizeAnnouncement)
  };
};

export const createDiscussion = async payload => {
  const response = await apiClient.post('/discussions', payload);
  return readDiscussion(response);
};

export const sendStudentMessage = async payload => {
  const response = await apiClient.post('/discussions/messages', payload);
  return readDiscussion(response);
};

export const replyToDiscussion = async (discussionId, content) => {
  const response = await apiClient.post(`/discussions/${discussionId}/replies`, { content });
  return readDiscussion(response);
};

export const updateDiscussionStatus = async (discussionId, status) => {
  const response = await apiClient.patch(`/discussions/${discussionId}/status`, { status });
  return readDiscussion(response);
};

export const markDiscussionRead = async discussionId => {
  const response = await apiClient.patch(`/discussions/${discussionId}/read`);
  return response.data.data;
};

export const getInstructorDiscussions = async (filters = {}) => {
  const params = {};
  if (filters.courseId && filters.courseId !== 'all') params.courseId = filters.courseId;
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.search?.trim()) params.search = filters.search.trim();
  const response = await apiClient.get('/discussions/instructor/threads', { params });
  return (response.data.data.discussions || []).map(normalizeDiscussion);
};

export const getInstructorInteractionSummary = async () => {
  const response = await apiClient.get('/discussions/instructor/summary');
  return response.data.data;
};

export const getInstructorAnnouncements = async () => {
  const response = await apiClient.get('/discussions/instructor/announcements');
  return (response.data.data.announcements || []).map(normalizeAnnouncement);
};

export const createCourseAnnouncement = async payload => {
  const response = await apiClient.post('/discussions/instructor/announcements', payload);
  return normalizeAnnouncement(response.data.data.announcement);
};

export const markAnnouncementRead = async announcementId => {
  const response = await apiClient.patch(`/discussions/announcements/${announcementId}/read`);
  return response.data.data;
};

export const discussionApiErrorMessage = (error, fallback) => (
  error?.response?.data?.message || error?.message || fallback
);
