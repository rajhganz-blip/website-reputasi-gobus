const crypto = require('crypto');
const { getPool } = require('../config/db');
const { snap, serverKey } = require('../config/midtrans');
const bookingService = require('./booking.service');
const notificationService = require('./notification.service');
const { BadRequestError, NotFoundError } = require('../utils/customError');

class PaymentService {
  async createPaymentToken(bookingCode) {
    const pool = getPool();
    
    // 1. Fetch booking details
    const booking = await bookingService.getBookingDetail(bookingCode);
    if (booking.payment_status !== 'pending') {
      throw new BadRequestError(`Pemesanan ini tidak berstatus pending (Status: ${booking.payment_status})`);
    }

    // Check if payment snap token already exists to avoid duplicate Midtrans transactions
    const [existing] = await pool.query('SELECT snap_token FROM payments WHERE booking_id = ? AND payment_status = "pending"', [booking.id]);
    if (existing.length > 0) {
      return {
        bookingCode,
        snapToken: existing[0].snap_token,
        amount: booking.total_price
      };
    }

    // 2. Prepare Midtrans snap transaction parameters
    const parameter = {
      transaction_details: {
        order_id: booking.booking_code,
        gross_amount: Math.round(booking.total_price)
      },
      customer_details: {
        first_name: booking.passenger_name,
        email: booking.passenger_email,
        phone: booking.passenger_phone
      },
      item_details: [
        {
          id: `SCH-${booking.schedule_id}`,
          price: Math.round(booking.original_price / booking.total_seats),
          quantity: booking.total_seats,
          name: `Tiket Bus GoBus (${booking.origin} - ${booking.destination})`
        }
      ],
      expiry: {
        duration: 30,
        unit: 'minutes'
      }
    };

    // If promo discount is applied, add a negative price item
    if (booking.discount_amount > 0) {
      parameter.item_details.push({
        id: `PROMO-${booking.promo_id || 'DISCOUNT'}`,
        price: -Math.round(booking.discount_amount),
        quantity: 1,
        name: `Potongan Promo / Diskon`
      });
    }

    try {
      // 3. Request Snap Token from Midtrans
      const transaction = await snap.createTransaction(parameter);
      const snapToken = transaction.token;

      // 4. Save payment transaction to DB
      await pool.query(`
        INSERT INTO payments (booking_id, snap_token, amount, payment_status)
        VALUES (?, ?, ?, 'pending')
      `, [booking.id, snapToken, booking.total_price]);

      return {
        bookingCode,
        snapToken,
        amount: booking.total_price
      };
    } catch (err) {
      console.error('Midtrans Snap Transaction Creation Failed:', err.message);
      throw new Error(`Koneksi Midtrans gagal: ${err.message}`);
    }
  }

  async handleWebhook(payload) {
    const pool = getPool();
    const {
      transaction_status,
      order_id, // booking_code
      payment_type,
      transaction_id,
      gross_amount,
      signature_key,
      status_code
    } = payload;

    // 1. Verify Midtrans Webhook Signature for high-grade security
    const localHash = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    if (localHash !== signature_key) {
      console.error(`🔒 SECURITY WARNING: Invalid webhook signature detected for order ${order_id}`);
      throw new BadRequestError('Signature key webhook tidak valid');
    }

    // 2. Retrieve Booking
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE booking_code = ?', [order_id]);
    if (bookings.length === 0) {
      throw new NotFoundError(`Pemesanan ${order_id} tidak ditemukan`);
    }
    const booking = bookings[0];

    let newBookingStatus = 'pending';
    let newPaymentStatus = 'pending';

    // Map Midtrans statuses to our internal DB statuses
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      newBookingStatus = 'paid';
      newPaymentStatus = 'settlement';
    } else if (transaction_status === 'deny' || transaction_status === 'cancel' || transaction_status === 'expire') {
      newBookingStatus = 'failed';
      newPaymentStatus = transaction_status;
    } else if (transaction_status === 'pending') {
      newBookingStatus = 'pending';
      newPaymentStatus = 'pending';
    }

    console.log(`Payment Webhook: Booking ${order_id} status updated to ${newBookingStatus}`);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Update payment record
      await conn.query(`
        UPDATE payments 
        SET transaction_id = ?, payment_method = ?, payment_status = ?, payload = ?
        WHERE booking_id = ?
      `, [transaction_id, payment_type, newPaymentStatus, JSON.stringify(payload), booking.id]);

      if (newBookingStatus === 'paid' && booking.payment_status !== 'paid') {
        // Complete the payment: update booking status and set confirmation timestamp
        await conn.query(`
          UPDATE bookings 
          SET payment_status = 'paid', confirmed_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [booking.id]);

        // Send notifications
        if (booking.user_id) {
          await notificationService.createNotification(
            booking.user_id,
            'payment_success',
            `Pembayaran tiket GoBus ${booking.booking_code} sebesar Rp ${parseFloat(booking.total_price).toLocaleString('id-ID')} telah sukses dikonfirmasi! E-Ticket Anda siap diunduh.`
          );
        }
      } else if (newBookingStatus === 'failed' && booking.payment_status === 'pending') {
        // Cancel the booking and release seats
        await conn.commit(); // commit current connection state to let cancel booking query open transaction cleanly
        await bookingService.cancelBooking(booking.id, null, `Gagal bayar: Midtrans transaksi berstatus ${transaction_status}`);
        return true;
      }

      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new PaymentService();
