import apiClient from './apiClient';

export const referralsAPI = {
  getMy: async () => {
    const response = await apiClient.get('/referrals/my');
    return response.data;
  },

  createWithUser: async (formData) => {
    const response = await apiClient.post('/referrals/with-user', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getAll: async (params = {}) => {
    const response = await apiClient.get('/referrals', { params });
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/referrals/stats');
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/referrals/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/referrals/${id}`);
    return response.data;
  }
};
