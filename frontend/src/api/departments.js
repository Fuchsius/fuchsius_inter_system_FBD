import apiClient from './apiClient';

export const departmentsAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/departments', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/departments/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/departments', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/departments/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/departments/${id}`);
    return response.data;
  }
};
