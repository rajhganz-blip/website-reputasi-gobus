const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const validate = require('../middleware/validation.middleware');
const { createBookingSchema } = require('../validations/booking.validation');
const { bookingLimiter } = require('../middleware/rateLimiter');

// Create a booking (optional token integration - binds user ID if present, otherwise guests checkout)
router.post('/', bookingLimiter, (req, res, next) => {
  // Gracefully skip verifyToken failures to allow Guest Checkouts
  const authHeader = req.headers['authorization'];
  if ((authHeader && authHeader.startsWith('Bearer ')) || (req.cookies && req.cookies.accessToken)) {
    return verifyToken(req, res, next);
  }
  next();
}, validate(createBookingSchema), bookingController.createBooking);

// Protected booking actions
router.get('/my-bookings', verifyToken, bookingController.getUserBookings);
router.get('/:id', verifyToken, bookingController.getBookingDetail);
router.post('/:id/cancel', verifyToken, bookingController.cancelBooking);

module.exports = router;
