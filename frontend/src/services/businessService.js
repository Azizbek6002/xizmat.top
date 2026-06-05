import api from '../api';

export const businessService = {
  getAll: (params = {}) => api.get('/businesses', { params }),
  getById: (id) => api.get(`/businesses/${id}`),
  getMy: () => api.get('/businesses/my'),
  create: (data) => api.post('/businesses', data),
  update: (id, data) => api.put(`/businesses/${id}`, data),
};
