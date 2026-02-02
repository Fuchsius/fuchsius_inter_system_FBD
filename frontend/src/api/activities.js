import apiClient from './apiClient';

export const activitiesAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/activities', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/activities/${id}`);
    return response.data;
  },

  getMyActivities: async (params = {}) => {
    const response = await apiClient.get('/activities/my', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/activities', data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/activities/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/activities/stats');
    return response.data;
  }
};
