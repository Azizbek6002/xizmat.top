import api from '../api';

export const serviceService = {
  getByBusiness: (businessId) => api.get(`/businesses/${businessId}/services`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  remove: (id) => api.delete(`/services/${id}`),
};
