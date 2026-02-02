import apiClient from './apiClient';

export const eventsAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/events', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/events/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/events/stats');
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/events', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/events/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/events/${id}`);
    return response.data;
  }
};
