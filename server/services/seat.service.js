const EventEmitter = require('events');
const { getPool } = require('../config/db');
const { BadRequestError, ConflictError } = require('../utils/customError');

class SeatService extends EventEmitter {
  async getBookedAndLockedSeats(scheduleId) {
    const pool = getPool();
    
    // Clear expired locks before checking
    await this.cleanupExpiredLocks();

    const [rows] = await pool.query(`
      SELECT seat_number, status, locked_until 
      FROM seats_availability 
      WHERE schedule_id = ?
    `, [scheduleId]);

    return rows.map(r => ({
      seatNumber: r.seat_number,
      status: r.status,
      lockedUntil: r.locked_until
    }));
  }

  async lockSeats(scheduleId, seatNumbers, userId) {
    const pool = getPool();
    const conn = await pool.getConnection();
    const lockedSeats = [];

    try {
      await conn.beginTransaction();

      // Clean expired locks inside transaction
      await conn.query(`
        DELETE FROM seats_availability 
        WHERE status = 'locked' AND locked_until <= CURRENT_TIMESTAMP
      `);

      const seats = seatNumbers.split(',').map(s => s.trim());
      const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock

      for (const seat of seats) {
        // Check if seat is locked or booked
        const [existing] = await conn.query(`
          SELECT * FROM seats_availability 
          WHERE schedule_id = ? AND seat_number = ? 
          FOR UPDATE
        `, [scheduleId, seat]);

        if (existing.length > 0) {
          const currentSeat = existing[0];
          if (currentSeat.status === 'booked') {
            throw new ConflictError(`Kursi ${seat} sudah dipesan secara permanen.`);
          } else if (currentSeat.status === 'locked') {
            if (currentSeat.locked_by_user_id === userId) {
              // Same user renewing lock
              await conn.query(`
                UPDATE seats_availability 
                SET locked_until = ? 
                WHERE id = ?
              `, [expiryTime, currentSeat.id]);
              lockedSeats.push(seat);
              continue;
            } else {
              throw new ConflictError(`Kursi ${seat} sedang dikunci oleh pengguna lain.`);
            }
          }
        }

        // Insert new lock
        await conn.query(`
          INSERT INTO seats_availability (schedule_id, seat_number, status, locked_by_user_id, locked_until)
          VALUES (?, ?, 'locked', ?, ?)
          ON DUPLICATE KEY UPDATE 
            status = 'locked', 
            locked_by_user_id = VALUES(locked_by_user_id), 
            locked_until = VALUES(locked_until)
        `, [scheduleId, seat, userId, expiryTime]);

        lockedSeats.push(seat);
      }

      await conn.commit();

      // Broadcast changes
      this.emit('seat:locked', { scheduleId, seats: lockedSeats, userId, expiryTime });

      return {
        success: true,
        message: 'Kursi berhasil dikunci selama 15 menit',
        seats: lockedSeats,
        lockedUntil: expiryTime
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async releaseSeats(scheduleId, seatNumbers, userId) {
    const pool = getPool();
    const conn = await pool.getConnection();
    const releasedSeats = [];

    try {
      await conn.beginTransaction();

      const seats = seatNumbers.split(',').map(s => s.trim());

      for (const seat of seats) {
        // Delete only locks belonging to the user
        const [result] = await conn.query(`
          DELETE FROM seats_availability 
          WHERE schedule_id = ? AND seat_number = ? AND status = 'locked' AND locked_by_user_id = ?
        `, [scheduleId, seat, userId]);

        if (result.affectedRows > 0) {
          releasedSeats.push(seat);
        }
      }

      await conn.commit();

      if (releasedSeats.length > 0) {
        this.emit('seat:released', { scheduleId, seats: releasedSeats, userId });
      }

      return {
        success: true,
        message: 'Kursi berhasil dilepas',
        seats: releasedSeats
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async finalizeBookingSeats(scheduleId, seatNumbers, bookingId, connection = null) {
    const pool = connection || getPool();
    const seats = seatNumbers.split(',').map(s => s.trim());

    for (const seat of seats) {
      // Overwrite/upsert to permanently booked
      await pool.query(`
        INSERT INTO seats_availability (schedule_id, seat_number, status, booking_id)
        VALUES (?, ?, 'booked', ?)
        ON DUPLICATE KEY UPDATE 
          status = 'booked', 
          booking_id = VALUES(booking_id), 
          locked_by_user_id = NULL, 
          locked_until = NULL
      `, [scheduleId, seat, bookingId]);
    }

    this.emit('seat:booked', { scheduleId, seats, bookingId });
  }

  async cleanupExpiredLocks() {
    try {
      const pool = getPool();
      const [result] = await pool.query(`
        DELETE FROM seats_availability 
        WHERE status = 'locked' AND locked_until <= CURRENT_TIMESTAMP
      `);
      if (result.affectedRows > 0) {
        this.emit('seats:expired_cleanup', { affected: result.affectedRows });
      }
    } catch (err) {
      console.error('Seat clean-up job failed:', err.message);
    }
  }
}

module.exports = new SeatService();
