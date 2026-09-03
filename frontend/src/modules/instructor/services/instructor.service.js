import apiClient from '../../../config/api.config';

export const getInstructorAnalytics = async (range = 30) => {
  const response = await apiClient.get('/instructor/analytics', {
    params: { range }
  });

  if (!response.data?.success || !response.data?.data) {
    throw new Error('Dữ liệu Analytics trả về không hợp lệ');
  }

  return response.data.data;
};

export const instructorService = {
  uploadMedia: async (file, {
    courseName,
    courseId,
    sectionName,
    sectionOrder,
    lessonName,
    lessonOrder
  } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (courseName) formData.append('courseName', courseName);
    if (courseId) formData.append('courseId', String(courseId));
    if (sectionName) formData.append('sectionName', sectionName);
    if (sectionOrder) formData.append('sectionOrder', String(sectionOrder));
    if (lessonName) formData.append('lessonName', lessonName);
    if (lessonOrder) formData.append('lessonOrder', String(lessonOrder));
    
    const response = await apiClient.post('/courses/upload', formData, {
      timeout: 300000,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  createCourse: async (courseData) => {
    const response = await apiClient.post('/courses', courseData);
    return response.data;
  },

  getAnalytics: getInstructorAnalytics
};
