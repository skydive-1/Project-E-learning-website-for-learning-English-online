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
  uploadMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/courses/upload', formData, {
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
