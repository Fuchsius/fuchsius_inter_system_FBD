import apiClient from './apiClient';

export const authAPI = {
  getProfile: async () => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  changePassword: async (data) => {
    const response = await apiClient.put('/auth/change-password', data);
    return response.data;
  },

  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  }
};
