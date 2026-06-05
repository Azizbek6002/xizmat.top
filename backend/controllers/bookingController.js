const { randomUUID } = require('crypto');
const { db, normalizeBusiness, normalizeService } = require('../config/db');
const { isFlashActive } = require('./serviceController');

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};

const fromMinutes = (minutes) => `${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const overlaps = (serviceId, date, startTime, endTime, excludeId = null) => {
  const params = { serviceId, date, startTime, endTime, excludeId };
  const exclude = excludeId ? 'AND id != @excludeId' : '';
  return db.prepare(`
    SELECT 1 FROM bookings
    WHERE service_id = @serviceId AND date = @date
      AND status NOT IN ('cancelled', 'rejected')
      AND start_time < @endTime AND end_time > @startTime
      ${exclude}
    LIMIT 1
  `).get(params);
};

const createNotification = (userId, type, title, message) => {
  db.prepare('INSERT INTO notifications (id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, type, title, message);
};

const getAvailableSlots = async (req, res) => {
  const { serviceId } = req.params;
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: 'date is required' });

  const service = normalizeService(db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(serviceId));
  if (!service) return res.status(404).json({ message: 'Service not found' });

  const business = normalizeBusiness(db.prepare('SELECT * FROM businesses WHERE id = ?').get(service.business));
  if (!business) return res.status(404).json({ message: 'Business not found' });

  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = business.workingHours?.[dayKeys[new Date(`${date}T00:00:00`).getDay()]] || { open: '09:00', close: '20:00' };
  if (day.closed) return res.json([]);

  const open = toMinutes(day.open || '09:00');
  let close = toMinutes(day.close || '20:00');
  if (close <= open) close += 24 * 60;
  const duration = Number(service.durationMinutes || 60);
  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);

  const slots = [];
  for (let start = open; start + duration <= close; start += 30) {
    const startTime = fromMinutes(start);
    const endTime = fromMinutes(start + duration);
    const isPast = isToday && start <= now.getHours() * 60 + now.getMinutes();
    const isBooked = Boolean(overlaps(service._id, date, startTime, endTime));
    slots.push({ time: startTime, endTime, disabled: isPast || isBooked, status: isBooked ? 'booked' : isPast ? 'past' : 'available' });
  }

  res.json(slots);
};

const createBooking = async (req, res) => {
  const { businessId, serviceId, date, startTime, endTime } = req.body;
  if (!businessId || !serviceId || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'businessId, serviceId, date, startTime and endTime are required' });
  }

  const service = normalizeService(db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(serviceId));
  if (!service) return res.status(404).json({ message: 'Service not found' });
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (service.business !== businessId) return res.status(400).json({ message: 'Service does not belong to this business' });
  if (business.status !== 'approved') return res.status(400).json({ message: 'Business is not available for booking' });
  if (overlaps(serviceId, date, startTime, endTime)) return res.status(400).json({ message: 'Service already booked for this time' });

  const activeFlash = isFlashActive(service);
  const unitPrice = activeFlash ? service.discountPrice : service.price;
  const sessions = Math.max(1, Math.ceil((toMinutes(endTime) - toMinutes(startTime)) / Number(service.durationMinutes || 60)));
  const totalPrice = unitPrice * sessions;
  const id = randomUUID();

  db.prepare(`
    INSERT INTO bookings (
      id, user_id, business_id, service_id, date, start_time, end_time,
      total_price, original_price, final_price, was_flash_deal, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, req.user._id, businessId, serviceId, date, startTime, endTime, totalPrice, service.price * sessions, totalPrice, activeFlash ? 1 : 0);

  createNotification(req.user._id, 'booking_created', 'Booking created', 'Your booking is waiting for confirmation.');
  createNotification(business.owner_id, 'booking_created', 'New booking request', 'You have a new booking request.');

  res.status(201).json({
    _id: id,
    user: req.user._id,
    business: businessId,
    service: serviceId,
    date,
    startTime,
    endTime,
    totalPrice,
    originalPrice: service.price * sessions,
    finalPrice: totalPrice,
    wasFlashDeal: activeFlash,
    status: 'pending',
  });
};

const bookingRowToJson = (row) => ({
  _id: row.id,
  date: row.date,
  startTime: row.start_time,
  endTime: row.end_time,
  totalPrice: row.total_price,
  originalPrice: row.original_price,
  finalPrice: row.final_price,
  wasFlashDeal: Boolean(row.was_flash_deal),
  status: row.status,
  statusReason: row.status_reason || '',
  createdAt: row.created_at,
  business: row.business_id ? normalizeBusiness({
    id: row.business_id,
    owner_id: row.owner_id,
    name: row.business_name,
    address: row.business_address,
    category: row.business_category,
    photos: row.business_photos,
    lat: row.business_lat,
    lng: row.business_lng,
    status: row.business_status,
  }) : null,
  service: row.service_id ? normalizeService({
    id: row.service_id,
    business_id: row.business_id,
    name: row.service_name,
    price: row.service_price,
    duration_minutes: row.service_duration,
    is_active: 1,
    is_flash_deal: row.service_is_flash_deal || 0,
    discount_price: row.service_discount_price,
    flash_deal_ends_at: row.service_flash_deal_ends_at,
  }) : null,
  user: row.user_id ? { _id: row.user_id, name: row.user_name, email: row.user_email } : undefined,
});

const getMyBookings = async (req, res) => {
  const rows = db.prepare(`
    SELECT bk.*, b.owner_id, b.name AS business_name, b.address AS business_address, b.category AS business_category,
      b.photos AS business_photos, b.lat AS business_lat, b.lng AS business_lng, b.status AS business_status,
      s.name AS service_name, s.price AS service_price, s.duration_minutes AS service_duration,
      s.is_flash_deal AS service_is_flash_deal, s.discount_price AS service_discount_price, s.flash_deal_ends_at AS service_flash_deal_ends_at
    FROM bookings bk
    LEFT JOIN businesses b ON b.id = bk.business_id
    LEFT JOIN services s ON s.id = bk.service_id
    WHERE bk.user_id = ?
    ORDER BY bk.date DESC, bk.start_time DESC
  `).all(req.user._id);
  res.json(rows.map(bookingRowToJson));
};

const getBusinessBookings = async (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (business.owner_id !== req.user._id && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

  const rows = db.prepare(`
    SELECT bk.*, u.name AS user_name, u.email AS user_email, b.owner_id, b.name AS business_name, b.address AS business_address,
      b.category AS business_category, b.photos AS business_photos, b.lat AS business_lat, b.lng AS business_lng, b.status AS business_status,
      s.name AS service_name, s.price AS service_price, s.duration_minutes AS service_duration
    FROM bookings bk
    LEFT JOIN users u ON u.id = bk.user_id
    LEFT JOIN businesses b ON b.id = bk.business_id
    LEFT JOIN services s ON s.id = bk.service_id
    WHERE bk.business_id = ?
    ORDER BY bk.date DESC, bk.start_time DESC
  `).all(req.params.businessId);
  res.json(rows.map(bookingRowToJson));
};

const updateBookingStatus = (allowedStatuses) => async (req, res) => {
  const booking = db.prepare('SELECT bk.*, b.owner_id FROM bookings bk JOIN businesses b ON b.id = bk.business_id WHERE bk.id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const isOwner = booking.owner_id === req.user._id || req.user.role === 'admin';
  const isUser = booking.user_id === req.user._id;
  if (!isOwner && !isUser) return res.status(403).json({ message: 'Not authorized' });

  const status = req.body.status || allowedStatuses[0];
  if (!allowedStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  if (['confirmed', 'rejected', 'completed'].includes(status) && !isOwner) return res.status(403).json({ message: 'Only owner can set this status' });

  db.prepare('UPDATE bookings SET status = ?, status_reason = ? WHERE id = ?').run(status, req.body.reason || '', req.params.id);
  createNotification(booking.user_id, `booking_${status}`, 'Booking status updated', `Your booking status is now ${status}.`);
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id));
};

module.exports = {
  createBooking,
  getAvailableSlots,
  getMyBookings,
  getBusinessBookings,
  cancelBooking: updateBookingStatus(['cancelled']),
  confirmBooking: updateBookingStatus(['confirmed']),
  rejectBooking: updateBookingStatus(['rejected']),
  completeBooking: updateBookingStatus(['completed']),
};
