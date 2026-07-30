import apiClient from '../../../config/api.config';

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
  }
};
