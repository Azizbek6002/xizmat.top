import api from '../api';

export const bookingService = {
  create: (data) => api.post('/bookings', data),
  getMy: () => api.get('/bookings/my'),
  cancel: (id) => api.patch(`/bookings/${id}/cancel`),
  getByBusiness: (businessId) => api.get(`/bookings/business/${businessId}`),
  confirm: (id) => api.patch(`/bookings/${id}/confirm`),
  reject: (id, reason) => api.patch(`/bookings/${id}/reject`, { reason }),
  complete: (id) => api.patch(`/bookings/${id}/complete`),
  getSlots: (serviceId, date) => api.get(`/bookings/slots/${serviceId}`, { params: { date } }),
};
