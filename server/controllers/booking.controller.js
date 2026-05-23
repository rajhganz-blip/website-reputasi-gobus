const bookingService = require('../services/booking.service');

class BookingController {
  async createBooking(req, res, next) {
    try {
      // If user is authenticated, attach user_id. Supports guest bookings as well.
      const userId = req.user ? req.user.id : null;
      const result = await bookingService.createBooking(userId, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Pemesanan tiket berhasil diproses! Harap segera lakukan pembayaran.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getBookingDetail(req, res, next) {
    try {
      const booking = await bookingService.getBookingDetail(req.params.id);
      res.json({
        success: true,
        message: 'Detail pemesanan berhasil dimuat!',
        data: booking
      });
    } catch (err) {
      next(err);
    }
  }

  async getUserBookings(req, res, next) {
    try {
      const bookings = await bookingService.getUserBookings(req.user.id);
      res.json({
        success: true,
        message: 'Riwayat pemesanan Anda berhasil diambil!',
        data: bookings
      });
    } catch (err) {
      next(err);
    }
  }

  async cancelBooking(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      await bookingService.cancelBooking(parseInt(req.params.id), userId, 'Dibatalkan atas permintaan pengguna.');
      
      res.json({
        success: true,
        message: 'Pemesanan berhasil dibatalkan!'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BookingController();
