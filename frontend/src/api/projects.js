import apiClient from './apiClient';

export const projectsAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await apiClient.get('/projects', {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await apiClient.get(`/projects/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching project by id:', error);
      throw error;
    }
  },

  getStats: async (params = {}) => {
    try {
      const response = await apiClient.get('/projects/stats', {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching project stats:', error);
      throw error;
    }
  },

  getMyProjects: async () => {
    try {
      const response = await apiClient.get('/projects/my', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching my projects:', error);
      throw error;
    }
  },

  create: async (data) => {
    try {
      const response = await apiClient.post('/projects', data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const response = await apiClient.put(`/projects/${id}`, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await apiClient.delete(`/projects/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
};
