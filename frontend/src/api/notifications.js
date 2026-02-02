import apiClient from './apiClient';

export const notificationsAPI = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  getMy: async (params = {}) => {
    const response = await apiClient.get('/notifications/my', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/notifications', data);
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  }
};
