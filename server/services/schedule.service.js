const { getPool } = require('../config/db');
const { NotFoundError } = require('../utils/customError');

class ScheduleService {
  async searchSchedules(filters) {
    const pool = getPool();
    const {
      origin,
      destination,
      date,
      priceMin,
      priceMax,
      operator,
      facilities,
      sortBy = 'time_asc',
      page = 1,
      limit = 10
    } = filters;

    // First auto-seed schedules for target search date if none exist (dynamic scheduler fallback)
    await this.autoSeedSchedulesForDate(date);

    let whereClause = 's.travel_date = ? AND s.status = "active"';
    const params = [date];

    // Origin and Destination filters
    whereClause += ' AND r.origin LIKE ?';
    params.push(`%${origin}%`);

    whereClause += ' AND r.destination LIKE ?';
    params.push(`%${destination}%`);

    // Price filters
    if (priceMin !== undefined && priceMin !== '') {
      whereClause += ' AND s.base_price >= ?';
      params.push(parseFloat(priceMin));
    }
    if (priceMax !== undefined && priceMax !== '') {
      whereClause += ' AND s.base_price <= ?';
      params.push(parseFloat(priceMax));
    }

    // Operator (Bus operator / company name)
    if (operator) {
      whereClause += ' AND b.name LIKE ?';
      params.push(`%${operator}%`);
    }

    // Facilities (e.g., AC, Toilet, WiFi)
    if (facilities) {
      const facilityArray = facilities.split(',').map(f => f.trim());
      facilityArray.forEach(f => {
        whereClause += ' AND b.facilities LIKE ?';
        params.push(`%${f}%`);
      });
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Sorting
    let orderBy = 's.departure_time ASC';
    if (sortBy === 'price_asc') {
      orderBy = 's.base_price ASC';
    } else if (sortBy === 'price_desc') {
      orderBy = 's.base_price DESC';
    } else if (sortBy === 'time_desc') {
      orderBy = 's.departure_time DESC';
    }

    // Count query for metadata
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN buses b ON s.bus_id = b.id
      WHERE ${whereClause}
    `;
    const [[countResult]] = await pool.query(countQuery, params);
    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limitNum);

    // Optimized select query with pre-defined search index coverage
    const selectQuery = `
      SELECT s.id, s.travel_date, s.departure_time, s.arrival_time, s.base_price, s.available_seats, s.status,
             r.origin, r.destination, r.distance_km, r.description as route_description,
             b.name as bus_name, b.bus_class, b.facilities, b.image_url, b.total_seats
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN buses b ON s.bus_id = b.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    // Add pagination params
    params.push(limitNum, offset);

    const [rows] = await pool.query(selectQuery, params);

    return {
      schedules: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages
      }
    };
  }

  async getScheduleById(id) {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT s.*, r.origin, r.destination, r.distance_km,
             b.name as bus_name, b.bus_class, b.facilities, b.image_url, b.total_seats
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN buses b ON s.bus_id = b.id
      WHERE s.id = ?
    `, [id]);

    if (rows.length === 0) {
      throw new NotFoundError('Jadwal keberangkatan tidak ditemukan');
    }

    return rows[0];
  }

  async createSchedule(data) {
    const pool = getPool();
    const { route_id, bus_id, departure_time, arrival_time, travel_date, base_price } = data;

    // Fetch total seats from bus
    const [buses] = await pool.query('SELECT total_seats FROM buses WHERE id = ?', [bus_id]);
    if (buses.length === 0) {
      throw new NotFoundError('Bus yang dipilih tidak terdaftar');
    }
    const totalSeats = buses[0].total_seats;

    const [result] = await pool.query(`
      INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, travel_date, base_price, available_seats)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [route_id, bus_id, departure_time, arrival_time, travel_date, base_price, totalSeats]);

    return { id: result.insertId, ...data, available_seats: totalSeats };
  }

  async updateSchedule(id, data) {
    const pool = getPool();
    await this.getScheduleById(id); // Ensure exists

    const { route_id, bus_id, departure_time, arrival_time, travel_date, base_price, status } = data;
    await pool.query(`
      UPDATE schedules 
      SET route_id = ?, bus_id = ?, departure_time = ?, arrival_time = ?, travel_date = ?, base_price = ?, status = ?
      WHERE id = ?
    `, [route_id, bus_id, departure_time, arrival_time, travel_date, base_price, status, id]);

    return { id, ...data };
  }

  async deleteSchedule(id) {
    const pool = getPool();
    await this.getScheduleById(id); // Ensure exists

    // Mark as cancelled instead of hard deleting to preserve historical bookings
    await pool.query('UPDATE schedules SET status = "cancelled" WHERE id = ?', [id]);
    return true;
  }

  // Seeder helper to duplicate template schedules when date is queried
  async autoSeedSchedulesForDate(targetDate) {
    try {
      const pool = getPool();
      const [existing] = await pool.query('SELECT id FROM schedules WHERE travel_date = ? LIMIT 1', [targetDate]);
      if (existing.length > 0) return;

      // Pull active routes and buses to dynamic populate
      const [routes] = await pool.query('SELECT id FROM routes WHERE is_active = 1');
      const [buses] = await pool.query('SELECT id, total_seats FROM buses WHERE is_active = 1');

      if (routes.length === 0 || buses.length === 0) return;

      // Set standard departures
      const departures = [
        { dep: '08:00:00', arr: '11:00:00', priceCoeff: 1.0 },
        { dep: '13:00:00', arr: '16:00:00', priceCoeff: 1.1 },
        { dep: '19:00:00', arr: '22:00:00', priceCoeff: 1.25 }
      ];

      for (const route of routes) {
        for (let i = 0; i < departures.length; i++) {
          const bus = buses[i % buses.length];
          const route_id = route.id;
          const bus_id = bus.id;
          const depTime = departures[i].dep;
          const arrTime = departures[i].arr;
          const price = 120000 * departures[i].priceCoeff;
          
          await pool.query(`
            INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, travel_date, base_price, available_seats)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [route_id, bus_id, depTime, arrTime, targetDate, price, bus.total_seats]);
        }
      }
      console.log(`💡 Seeder: Generated 21 test schedules for ${targetDate}`);
    } catch (err) {
      console.error('Auto seeding failed:', err.message);
    }
  }
}

module.exports = new ScheduleService();
