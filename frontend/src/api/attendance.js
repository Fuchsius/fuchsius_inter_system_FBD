import apiClient from './apiClient';

export const attendanceAPI = {
  checkIn: async () => {
    const response = await apiClient.post('/attendance/checkin');
    return response.data;
  },

  checkOut: async () => {
    const response = await apiClient.post('/attendance/checkout');
    return response.data;
  },

  getMyAttendance: async (page = 1, limit = 10, date = null, status = null) => {
    const params = { page, limit };
    if (date) params.date = date;
    if (status) params.status = status;
    
    const response = await apiClient.get('/attendance/my', { params });
    return response.data;
  },

  getTodayAttendance: async () => {
    const response = await apiClient.get('/attendance/today');
    return response.data;
  },

  getAll: async (params = {}) => {
    const response = await apiClient.get('/attendance', { params });
    return response.data;
  },

  getStats: async (params = {}) => {
    const response = await apiClient.get('/attendance/stats', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/attendance', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/attendance/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/attendance/${id}`);
    return response.data;
  }
};
