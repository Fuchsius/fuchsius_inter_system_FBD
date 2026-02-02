import apiClient from './apiClient';

export const usersAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },

  updateAvatar: async (id, formData) => {
    const response = await apiClient.put(`/users/${id}`, formData);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/users/stats');
    return response.data;
  }
};
