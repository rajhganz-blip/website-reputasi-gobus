const { getPool } = require('../config/db');
const notificationService = require('./notification.service');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/customError');

class RefundService {
  async requestRefund(userId, { booking_code, reason, bank_name, bank_account }) {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Check booking eligibility
      const [bookings] = await conn.query(`
        SELECT * FROM bookings 
        WHERE booking_code = ? AND user_id = ? 
        FOR UPDATE
      `, [booking_code, userId]);

      if (bookings.length === 0) {
        throw new NotFoundError('Pemesanan tidak ditemukan atau Anda tidak memiliki akses');
      }

      const booking = bookings[0];

      if (booking.payment_status !== 'paid') {
        throw new BadRequestError('Hanya tiket yang berstatus lunas (PAID) yang dapat diajukan pengembalian dana');
      }

      // Update booking status
      await conn.query('UPDATE bookings SET payment_status = "refund_requested" WHERE id = ?', [booking.id]);

      // Create refund application
      const [result] = await conn.query(`
        INSERT INTO refunds (booking_id, user_id, amount, reason, bank_name, bank_account, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `, [booking.id, userId, booking.total_price, reason, bank_name, bank_account]);

      await conn.commit();

      // Notify customer
      await notificationService.createNotification(
        userId,
        'refund_requested',
        `Pengajuan refund untuk tiket GoBus ${booking_code} sebesar Rp ${parseFloat(booking.total_price).toLocaleString('id-ID')} telah diterima dan sedang diproses admin.`
      );

      return {
        refundId: result.insertId,
        bookingCode: booking_code,
        amount: booking.total_price,
        status: 'pending'
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getRefunds(status = null) {
    const pool = getPool();
    let query = `
      SELECT r.*, b.booking_code, u.name as user_name, u.email as user_email
      FROM refunds r
      JOIN bookings b ON r.booking_id = b.id
      JOIN users u ON r.user_id = u.id
    `;
    const params = [];
    if (status) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }
    query += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query(query, params);
    return rows;
  }

  async approveRefund(refundId, adminNotes = null) {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Get refund with booking lock
      const [refunds] = await conn.query(`
        SELECT r.*, b.booking_code, b.schedule_id, b.seat_numbers, b.total_seats, b.user_id
        FROM refunds r
        JOIN bookings b ON r.booking_id = b.id
        WHERE r.id = ? AND r.status = 'pending'
        FOR UPDATE
      `, [refundId]);

      if (refunds.length === 0) {
        throw new NotFoundError('Pengajuan refund pending tidak ditemukan');
      }

      const refund = refunds[0];

      // 1. Update refund status
      await conn.query('UPDATE refunds SET status = "approved", admin_notes = ? WHERE id = ?', [adminNotes, refundId]);

      // 2. Update booking payment_status
      await conn.query('UPDATE bookings SET payment_status = "refunded" WHERE id = ?', [refund.booking_id]);

      // 3. Release locked/booked seats in seats_availability
      await conn.query('DELETE FROM seats_availability WHERE booking_id = ?', [refund.booking_id]);

      // 4. Return seats back to schedule available capacity
      await conn.query('UPDATE schedules SET available_seats = available_seats + ? WHERE id = ?', [refund.total_seats, refund.schedule_id]);

      await conn.commit();

      // Notify customer
      if (refund.user_id) {
        await notificationService.createNotification(
          refund.user_id,
          'refund_approved',
          `Pengajuan pengembalian dana tiket ${refund.booking_code} senilai Rp ${parseFloat(refund.amount).toLocaleString('id-ID')} telah disetujui admin dan ditransfer ke rekening Anda.`
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

  async rejectRefund(refundId, adminNotes) {
    if (!adminNotes) {
      throw new BadRequestError('Alasan penolakan (catatan admin) wajib diisi');
    }

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [refunds] = await conn.query(`
        SELECT r.*, b.booking_code, b.user_id
        FROM refunds r
        JOIN bookings b ON r.booking_id = b.id
        WHERE r.id = ? AND r.status = 'pending'
        FOR UPDATE
      `, [refundId]);

      if (refunds.length === 0) {
        throw new NotFoundError('Pengajuan refund pending tidak ditemukan');
      }

      const refund = refunds[0];

      // 1. Update refund status to rejected
      await conn.query('UPDATE refunds SET status = "rejected", admin_notes = ? WHERE id = ?', [adminNotes, refundId]);

      // 2. Revert booking status to paid
      await conn.query('UPDATE bookings SET payment_status = "paid" WHERE id = ?', [refund.booking_id]);

      await conn.commit();

      // Notify customer
      if (refund.user_id) {
        await notificationService.createNotification(
          refund.user_id,
          'refund_rejected',
          `Pengajuan pengembalian dana tiket ${refund.booking_code} ditolak. Alasan: ${adminNotes}`
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
}

module.exports = new RefundService();
