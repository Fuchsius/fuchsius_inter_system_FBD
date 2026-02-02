import apiClient from './apiClient';

export const positionsAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/positions', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/positions/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/positions', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/positions/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/positions/${id}`);
    return response.data;
  }
};
