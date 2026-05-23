// ============================================
// EXAMPLE: Using Stored Procedures for Booking
// ============================================

/**
 * Example implementation showing how to use the 
 * stored procedures: CreateBookingWithPromo & UpdatePromoUsage
 * 
 * This is SIMPLER and MORE ATOMIC than application-level logic
 */

const { getPool } = require('../config/db');

class BookingServiceWithStoredProc {
  /**
   * Create booking using stored procedure
   * This handles all logic atomically in database:
   * - Validate schedule & promo
   * - Calculate pricing
   * - Lock seats
   * - Update available_seats
   * - Increment promo usage
   */
  async createBookingSimple(userId, data) {
    const pool = getPool();

    const {
      schedule_id,
      passenger_name,
      passenger_phone,
      passenger_email,
      seat_numbers,
      num_seats,
      promo_code
    } = data;

    // Generate unique booking code
    const bookingCode = this.generateCode();

    try {
      // Call stored procedure - everything happens atomically in DB
      const [result] = await pool.query(
        `CALL CreateBookingWithPromo(?, ?, ?, ?, ?, ?, ?, ?, ?, @booking_id, @message)`,
        [
          bookingCode,
          userId || null,
          schedule_id,
          passenger_name,
          passenger_phone,
          passenger_email,
          seat_numbers,
          num_seats,
          promo_code || null
        ]
      );

      // Get output parameters
      const [outParams] = await pool.query(
        'SELECT @booking_id as booking_id, @message as message'
      );

      const bookingId = outParams[0].booking_id;
      const message = outParams[0].message;

      if (!bookingId) {
        throw new Error(message || 'Booking creation failed');
      }

      // Fetch created booking details
      const [bookings] = await pool.query(
        'SELECT * FROM bookings WHERE id = ?',
        [bookingId]
      );

      return {
        success: true,
        bookingId,
        bookingCode,
        message: 'Pemesanan berhasil dibuat!',
        data: bookings[0]
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Update promo usage when booking is paid
   * Call this AFTER successful payment
   */
  async updatePromoOnPayment(bookingId) {
    const pool = getPool();

    try {
      await pool.query(
        'CALL UpdatePromoUsage(?)',
        [bookingId]
      );

      return { success: true, message: 'Promo usage updated' };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Get available seats using function
   */
  async getAvailableSeats(scheduleId) {
    const pool = getPool();

    try {
      const [result] = await pool.query(
        'SELECT GetAvailableSeats(?) as available_count',
        [scheduleId]
      );

      return result[0].available_count;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Calculate booking price using function
   */
  async calculatePrice(scheduleId, numSeats, promoCode) {
    const pool = getPool();

    try {
      const [result] = await pool.query(
        'SELECT CalculateBookingPrice(?, ?, ?) as pricing',
        [scheduleId, numSeats, promoCode || null]
      );

      const pricing = JSON.parse(result[0].pricing);
      return pricing;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Usage Example in controller:
   * 
   * async createBooking(req, res, next) {
   *   try {
   *     const result = await bookingService.createBookingSimple(
   *       req.user?.id,
   *       req.body
   *     );
   *     res.status(201).json(result);
   *   } catch (err) {
   *     next(err);
   *   }
   * }
   */

  generateCode() {
    return 'GB' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = new BookingServiceWithStoredProc();
