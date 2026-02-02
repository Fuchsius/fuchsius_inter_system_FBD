import apiClient from './apiClient';

export const tasksAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/tasks', { params });
    return response.data;
  },

  getMine: async (params = {}) => {
    const response = await apiClient.get('/tasks/my', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/tasks/${id}`);
    return response.data;
  },

  getStats: async (params = {}) => {
    const response = await apiClient.get('/tasks/stats', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/tasks', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/tasks/${id}`, data);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await apiClient.patch(`/tasks/${id}/status`, { status });
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data;
  }
};
