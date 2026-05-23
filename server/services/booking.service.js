const { getPool } = require('../config/db');
const seatService = require('./seat.service');
const promoService = require('./promo.service');
const notificationService = require('./notification.service');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/customError');

class BookingService {
  async createBooking(userId, data) {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const {
        schedule_id,
        passenger_name,
        passenger_phone,
        passenger_email,
        passenger_id_number,
        seat_numbers,
        promo_code,
        passengers // Array of { name, id_number, seat_number }
      } = data;

      // 1. Get Schedule with lock
      const [schedules] = await conn.query('SELECT * FROM schedules WHERE id = ? AND status = "active" FOR UPDATE', [schedule_id]);
      if (schedules.length === 0) {
        throw new NotFoundError('Jadwal keberangkatan tidak aktif atau tidak ditemukan');
      }
      const schedule = schedules[0];

      // 2. Validate selected seats
      const seatsToBook = seat_numbers.split(',').map(s => s.trim());
      const totalSeatsCount = seatsToBook.length;

      // Double-booking check: verify seats are not already booked or locked by someone else
      const [takenSeats] = await conn.query(`
        SELECT seat_number, status, locked_by_user_id, locked_until 
        FROM seats_availability 
        WHERE schedule_id = ? AND seat_number IN (?)
      `, [schedule_id, seatsToBook]);

      for (const t of takenSeats) {
        if (t.status === 'booked') {
          throw new ConflictError(`Kursi ${t.seat_number} sudah dipesan secara permanen`);
        } else if (t.status === 'locked') {
          // If locked by current user, proceed. If by someone else and not expired, error out.
          const isExpired = new Date(t.locked_until) <= new Date();
          if (t.locked_by_user_id !== userId && !isExpired) {
            throw new ConflictError(`Kursi ${t.seat_number} sedang terkunci untuk pengguna lain`);
          }
        }
      }

      // 3. Calculate Pricing
      const originalPrice = parseFloat(schedule.base_price) * totalSeatsCount;
      let discountAmount = 0;
      let promoId = null;

      if (promo_code) {
        const promo = await promoService.validatePromo(promo_code, originalPrice, conn);
        discountAmount = promo.discount;
        promoId = promo.id;
      }

      const totalPrice = originalPrice - discountAmount;

      // 4. Generate Unique Booking Code
      let bookingCode;
      let isUnique = false;
      while (!isUnique) {
        bookingCode = this.generateCode();
        const [existing] = await conn.query('SELECT id FROM bookings WHERE booking_code = ?', [bookingCode]);
        if (existing.length === 0) {
          isUnique = true;
        }
      }

      // 5. Expiration time (30 minutes to pay)
      const expiryDate = new Date(Date.now() + 30 * 60 * 1000);

      // 6. Insert Booking record
      const [bookingResult] = await conn.query(`
        INSERT INTO bookings (
          booking_code, user_id, schedule_id, passenger_name, passenger_phone, passenger_email, 
          passenger_id_number, seat_numbers, total_seats, promo_id, original_price, 
          discount_amount, total_price, payment_status, expired_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `, [
        bookingCode,
        userId || null,
        schedule_id,
        passenger_name,
        passenger_phone,
        passenger_email,
        passenger_id_number || null,
        seat_numbers,
        totalSeatsCount,
        promoId,
        originalPrice,
        discountAmount,
        totalPrice,
        expiryDate
      ]);

      const bookingId = bookingResult.insertId;

      // 7. Insert Passengers records
      for (const p of passengers) {
        await conn.query(`
          INSERT INTO passengers (booking_id, name, id_number, seat_number)
          VALUES (?, ?, ?, ?)
        `, [bookingId, p.name, p.id_number, p.seat_number]);
      }

      // 8. Convert lock/free seats into locked/booked status in seat persistence
      await seatService.finalizeBookingSeats(schedule_id, seat_numbers, bookingId, conn);

      // 9. Update Schedule available seats count
      await conn.query(`
        UPDATE schedules 
        SET available_seats = available_seats - ? 
        WHERE id = ?
      `, [totalSeatsCount, schedule_id]);

      // 10. Increment promo used count if applied
      if (promoId) {
        await conn.query('UPDATE promos SET used_count = used_count + 1 WHERE id = ?', [promoId]);
      }

      await conn.commit();

      // Send real-time notification
      if (userId) {
        await notificationService.createNotification(
          userId,
          'booking_created',
          `Pemesanan GoBus ${bookingCode} berhasil dibuat. Silakan selesaikan pembayaran sebelum ${expiryDate.toLocaleTimeString('id-ID')}`
        );
      }

      return {
        bookingId,
        bookingCode,
        totalPrice,
        expiredAt: expiryDate
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getBookingDetail(bookingCodeOrId) {
    const pool = getPool();
    const isCode = typeof bookingCodeOrId === 'string' && bookingCodeOrId.startsWith('GB');
    const queryField = isCode ? 'b.booking_code' : 'b.id';

    const [bookings] = await pool.query(`
      SELECT b.*, 
             s.departure_time, s.arrival_time, s.travel_date, s.base_price,
             r.origin, r.destination, r.distance_km,
             bus.name as bus_name, bus.bus_class, bus.facilities
      FROM bookings b
      JOIN schedules s ON b.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      JOIN buses bus ON s.bus_id = bus.id
      WHERE ${queryField} = ?
    `, [bookingCodeOrId]);

    if (bookings.length === 0) {
      throw new NotFoundError('Tiket pemesanan tidak ditemukan');
    }

    const booking = bookings[0];

    // Fetch passenger detail
    const [passengers] = await pool.query('SELECT * FROM passengers WHERE booking_id = ?', [booking.id]);
    booking.passengers = passengers;

    return booking;
  }

  async getUserBookings(userId) {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT b.*, 
             s.departure_time, s.arrival_time, s.travel_date,
             r.origin, r.destination, bus.name as bus_name
      FROM bookings b
      JOIN schedules s ON b.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      JOIN buses bus ON s.bus_id = bus.id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC
    `, [userId]);

    return rows;
  }

  async cancelBooking(bookingId, userId = null, reason = 'Dibatalkan oleh sistem/pengguna') {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      let query = 'SELECT * FROM bookings WHERE id = ? FOR UPDATE';
      const params = [bookingId];
      if (userId) {
        query = 'SELECT * FROM bookings WHERE id = ? AND user_id = ? FOR UPDATE';
        params.push(userId);
      }

      const [bookings] = await conn.query(query, params);
      if (bookings.length === 0) {
        throw new NotFoundError('Booking tidak ditemukan atau Anda tidak memiliki akses');
      }

      const booking = bookings[0];
      if (booking.payment_status !== 'pending') {
        throw new BadRequestError('Hanya pemesanan dengan pembayaran PENDING yang dapat dibatalkan');
      }

      // Update booking status
      await conn.query('UPDATE bookings SET payment_status = "failed" WHERE id = ?', [bookingId]);

      // Release seats from seats_availability
      await conn.query('DELETE FROM seats_availability WHERE booking_id = ?', [bookingId]);

      // Add back seats to schedule count
      await conn.query('UPDATE schedules SET available_seats = available_seats + ? WHERE id = ?', [booking.total_seats, booking.schedule_id]);

      // Decrease promo used count if applied
      if (booking.promo_id) {
        await conn.query('UPDATE promos SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?', [booking.promo_id]);
      }

      await conn.commit();

      if (booking.user_id) {
        await notificationService.createNotification(
          booking.user_id,
          'booking_cancelled',
          `Pemesanan GoBus Anda dengan kode ${booking.booking_code} telah dibatalkan. Alasan: ${reason}`
        );
      }

      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async checkExpiredBookings() {
    const pool = getPool();
    try {
      const [expired] = await pool.query(`
        SELECT id, booking_code, user_id 
        FROM bookings 
        WHERE payment_status = 'pending' AND expired_at <= CURRENT_TIMESTAMP
      `);

      for (const b of expired) {
        await this.cancelBooking(b.id, null, 'Waktu pembayaran telah habis (Expired)');
        console.log(`⏰ Booking Expired Cleanup: Cancelled booking ${b.booking_code}`);
      }
    } catch (err) {
      console.error('Error running expired booking cleanup:', err.message);
    }
  }

  generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'GB';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

module.exports = new BookingService();
