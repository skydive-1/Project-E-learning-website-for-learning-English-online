import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthConfig = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

export const instructorService = {
  uploadMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_URL}/courses/upload`, formData, {
      ...getAuthConfig(),
      headers: {
        ...getAuthConfig().headers,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  createCourse: async (courseData) => {
    const response = await axios.post(`${API_URL}/courses`, courseData, getAuthConfig());
    return response.data;
  }
};
