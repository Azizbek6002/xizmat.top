const express = require('express');
const {
  createBooking,
  getAvailableSlots,
  getMyBookings,
  cancelBooking,
  getBusinessBookings,
  confirmBooking,
  rejectBooking,
  completeBooking
} = require('../controllers/bookingController');
const { protect, owner } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .post(protect, createBooking);

router.get('/my', protect, getMyBookings);
router.get('/slots/:serviceId', getAvailableSlots);

router.patch('/:id/cancel', protect, cancelBooking);

router.get('/business/:businessId', protect, owner, getBusinessBookings);

router.patch('/:id/confirm', protect, owner, confirmBooking);
router.patch('/:id/reject', protect, owner, rejectBooking);
router.patch('/:id/complete', protect, owner, completeBooking);

module.exports = router;
