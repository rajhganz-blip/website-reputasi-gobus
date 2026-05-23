const { getPool } = require('../config/db');
const path = require('path');
const fs = require('fs');
const analyticsService = require('../services/analytics.service');

class AdminController {
  // ─── DASHBOARD STATS ─────────────────────────────────────────
  async getStats(req, res, next) {
    try {
      const pool = getPool();

      const [[todayRevRow]] = await pool.query(`
        SELECT COALESCE(SUM(total_price), 0) as todayRevenue
        FROM bookings
        WHERE payment_status = 'paid' AND DATE(booking_date) = CURDATE()
      `);

      const [[totalRevRow]] = await pool.query(`
        SELECT COALESCE(SUM(total_price), 0) as totalRevenue
        FROM bookings WHERE payment_status = 'paid'
      `);

      const [[pendingRow]] = await pool.query(`
        SELECT COUNT(*) as pendingBookings
        FROM bookings WHERE payment_status = 'pending'
      `);

      const [[schedulesTodayRow]] = await pool.query(`
        SELECT COUNT(*) as todaySchedules
        FROM schedules WHERE travel_date = CURDATE() AND status = 'active'
      `);

      const [recentBookings] = await pool.query(`
        SELECT b.booking_code, b.passenger_name, b.total_price, b.payment_status,
               r.origin, r.destination
        FROM bookings b
        JOIN schedules s ON b.schedule_id = s.id
        JOIN routes r ON s.route_id = r.id
        ORDER BY b.booking_date DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        stats: {
          todayRevenue: parseFloat(todayRevRow.todayRevenue) || 0,
          totalRevenue: parseFloat(totalRevRow.totalRevenue) || 0,
          pendingBookings: parseInt(pendingRow.pendingBookings) || 0,
          todaySchedules: parseInt(schedulesTodayRow.todaySchedules) || 0
        },
        recentBookings: recentBookings || []
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── DASHBOARD ANALYTICS (legacy) ────────────────────────────
  async getDashboardAnalytics(req, res, next) {
    try {
      const analytics = await analyticsService.getDashboardAnalytics();
      res.json({ success: true, message: 'Analitik dashboard admin berhasil dimuat!', data: analytics });
    } catch (err) {
      next(err);
    }
  }

  // ─── BOOKINGS ─────────────────────────────────────────────────
  async getBookings(req, res, next) {
    try {
      const pool = getPool();
      const { search = '', status = '' } = req.query;

      let where = '1=1';
      const params = [];

      if (search) {
        where += ' AND (b.booking_code LIKE ? OR b.passenger_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      if (status) {
        where += ' AND b.payment_status = ?';
        params.push(status);
      }

      const [rows] = await pool.query(`
        SELECT b.*, r.origin, r.destination, s.travel_date, s.departure_time
        FROM bookings b
        JOIN schedules s ON b.schedule_id = s.id
        JOIN routes r ON s.route_id = r.id
        WHERE ${where}
        ORDER BY b.booking_date DESC
        LIMIT 100
      `, params);

      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async confirmPayment(req, res, next) {
    try {
      const pool = getPool();
      const { booking_code, action } = req.body;

      if (!booking_code || !action) {
        return res.status(400).json({ success: false, message: 'booking_code dan action wajib diisi' });
      }

      const [bookings] = await pool.query('SELECT * FROM bookings WHERE booking_code = ?', [booking_code]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });
      }

      const newStatus = action === 'confirm' ? 'paid' : 'failed';
      await pool.query('UPDATE bookings SET payment_status = ? WHERE booking_code = ?', [newStatus, booking_code]);

      res.json({
        success: true,
        message: action === 'confirm'
          ? `Pembayaran booking ${booking_code} berhasil dikonfirmasi`
          : `Pembayaran booking ${booking_code} berhasil ditolak`
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── ROUTES CRUD ──────────────────────────────────────────────
  async getRoutes(req, res, next) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM routes ORDER BY id DESC');
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async createRoute(req, res, next) {
    try {
      const pool = getPool();
      const { origin, destination, distance_km, description, is_active = 1 } = req.body;
      if (!origin || !destination) {
        return res.status(400).json({ success: false, message: 'Origin dan destination wajib diisi' });
      }
      const [result] = await pool.query(
        'INSERT INTO routes (origin, destination, distance_km, description, is_active) VALUES (?, ?, ?, ?, ?)',
        [origin, destination, distance_km || 0, description || null, is_active]
      );
      res.status(201).json({ success: true, message: 'Rute berhasil ditambahkan', data: { id: result.insertId } });
    } catch (err) {
      next(err);
    }
  }

  async updateRoute(req, res, next) {
    try {
      const pool = getPool();
      const { origin, destination, distance_km, description, is_active } = req.body;
      await pool.query(
        'UPDATE routes SET origin=?, destination=?, distance_km=?, description=?, is_active=? WHERE id=?',
        [origin, destination, distance_km, description, is_active, req.params.id]
      );
      res.json({ success: true, message: 'Rute berhasil diperbarui' });
    } catch (err) {
      next(err);
    }
  }

  async deleteRoute(req, res, next) {
    try {
      const pool = getPool();
      await pool.query('UPDATE routes SET is_active = 0 WHERE id = ?', [req.params.id]);
      res.json({ success: true, message: 'Rute berhasil dinonaktifkan' });
    } catch (err) {
      next(err);
    }
  }

  // ─── BUSES ────────────────────────────────────────────────────
  async getBuses(req, res, next) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM buses WHERE is_active = 1 ORDER BY id');
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  // ─── SCHEDULES CRUD ───────────────────────────────────────────
  async getSchedules(req, res, next) {
    try {
      const pool = getPool();
      const [rows] = await pool.query(`
        SELECT s.*, r.origin, r.destination, b.name as bus_name, b.bus_class,
               b.total_seats
        FROM schedules s
        JOIN routes r ON s.route_id = r.id
        JOIN buses b ON s.bus_id = b.id
        ORDER BY s.travel_date DESC, s.departure_time ASC
        LIMIT 200
      `);
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async createSchedule(req, res, next) {
    try {
      const pool = getPool();
      const { route_id, bus_id, travel_date, departure_time, arrival_time, base_price, status = 'active' } = req.body;
      if (!route_id || !bus_id || !travel_date || !departure_time || !arrival_time || !base_price) {
        return res.status(400).json({ success: false, message: 'Semua field jadwal wajib diisi' });
      }
      // Get total_seats from bus
      const [[bus]] = await pool.query('SELECT total_seats FROM buses WHERE id = ?', [bus_id]);
      const totalSeats = bus ? bus.total_seats : 40;

      const [result] = await pool.query(
        'INSERT INTO schedules (route_id, bus_id, travel_date, departure_time, arrival_time, base_price, available_seats, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [route_id, bus_id, travel_date, departure_time, arrival_time, base_price, totalSeats, status]
      );
      res.status(201).json({ success: true, message: 'Jadwal berhasil ditambahkan', data: { id: result.insertId } });
    } catch (err) {
      next(err);
    }
  }

  async updateSchedule(req, res, next) {
    try {
      const pool = getPool();
      const { route_id, bus_id, travel_date, departure_time, arrival_time, base_price, status } = req.body;
      await pool.query(
        'UPDATE schedules SET route_id=?, bus_id=?, travel_date=?, departure_time=?, arrival_time=?, base_price=?, status=? WHERE id=?',
        [route_id, bus_id, travel_date, departure_time, arrival_time, base_price, status, req.params.id]
      );
      res.json({ success: true, message: 'Jadwal berhasil diperbarui' });
    } catch (err) {
      next(err);
    }
  }

  async deleteSchedule(req, res, next) {
    try {
      const pool = getPool();
      await pool.query('UPDATE schedules SET status = "cancelled" WHERE id = ?', [req.params.id]);
      res.json({ success: true, message: 'Jadwal berhasil dibatalkan' });
    } catch (err) {
      next(err);
    }
  }

  // ─── DISCOUNTS CRUD ───────────────────────────────────────────
  async getDiscounts(req, res, next) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM promos ORDER BY id DESC');
      // Normalize field names to match frontend expectations
      const normalized = rows.map(r => ({
        id: r.id,
        code: r.code,
        description: r.description || '',
        discount_type: 'percentage',
        discount_value: parseFloat(r.discount_percentage) || 0,
        min_purchase: parseFloat(r.min_purchase) || 0,
        max_uses: r.max_uses || 0,
        used_count: r.used_count || 0,
        valid_from: r.created_at,
        valid_until: r.expired_at,
        is_active: r.active
      }));
      res.json({ success: true, data: normalized });
    } catch (err) {
      next(err);
    }
  }

  async createDiscount(req, res, next) {
    try {
      const pool = getPool();
      const { code, description, discount_value, min_purchase = 0, max_uses = 100, valid_until, is_active = 1 } = req.body;
      if (!code || !discount_value || !valid_until) {
        return res.status(400).json({ success: false, message: 'Kode, nilai diskon, dan tanggal expire wajib diisi' });
      }
      await pool.query(
        'INSERT INTO promos (code, description, discount_percentage, min_purchase, max_uses, expired_at, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [code.toUpperCase(), description || null, discount_value, min_purchase, max_uses, valid_until, is_active]
      );
      res.status(201).json({ success: true, message: 'Promo berhasil ditambahkan' });
    } catch (err) {
      next(err);
    }
  }

  async updateDiscount(req, res, next) {
    try {
      const pool = getPool();
      const { code, description, discount_value, min_purchase, max_uses, valid_until, is_active } = req.body;
      await pool.query(
        'UPDATE promos SET code=?, description=?, discount_percentage=?, min_purchase=?, max_uses=?, expired_at=?, active=? WHERE id=?',
        [code, description, discount_value, min_purchase, max_uses, valid_until, is_active, req.params.id]
      );
      res.json({ success: true, message: 'Promo berhasil diperbarui' });
    } catch (err) {
      next(err);
    }
  }

  // ─── REVENUE ──────────────────────────────────────────────────
  async getRevenue(req, res, next) {
    try {
      const pool = getPool();

      const [monthly] = await pool.query(`
        SELECT DATE_FORMAT(booking_date, '%Y-%m') as month,
               COUNT(*) as count,
               COALESCE(SUM(total_price), 0) as revenue
        FROM bookings
        WHERE payment_status = 'paid'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `);

      const [byRoute] = await pool.query(`
        SELECT r.origin, r.destination,
               COUNT(b.id) as bookings,
               COALESCE(SUM(b.total_price), 0) as revenue
        FROM bookings b
        JOIN schedules s ON b.schedule_id = s.id
        JOIN routes r ON s.route_id = r.id
        WHERE b.payment_status = 'paid'
        GROUP BY r.id, r.origin, r.destination
        ORDER BY revenue DESC
        LIMIT 10
      `);

      res.json({ success: true, monthly, byRoute });
    } catch (err) {
      next(err);
    }
  }

  // ─── QRIS UPLOAD ──────────────────────────────────────────────
  async uploadQris(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'File QRIS tidak ditemukan' });
      }
      const qrisUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, message: 'QRIS berhasil diupload', qris_url: qrisUrl });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
