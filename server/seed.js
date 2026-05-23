/**
 * GoBus – Seed Script
 * Run: node server/seed.js
 * Inserts sample data so the admin dashboard shows real numbers.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const cfg = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'gobus',
  multipleStatements: true
};

async function seed() {
  const conn = await mysql.createConnection(cfg);
  console.log('✅ Connected to MySQL');

  try {
    // ── Buses ─────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO buses (id, name, bus_class, total_seats, facilities, image_url) VALUES
      (1, 'Rosalia Indah Executive', 'Executive',      34, 'AC,Reclining Seat,WiFi,Selimut,Bantal',   '/images/bus.jpg'),
      (2, 'Sumber Alam Super Exec',  'Super Executive', 28, 'AC,Full Reclining,WiFi,Makan,Toilet',     '/images/bus.jpg'),
      (3, 'PO Haryanto Economy',     'Economy',        44, 'AC,Reclining Seat',                        '/images/bus.jpg'),
      (4, 'Kramat Djati Executive',  'Executive',      34, 'AC,Reclining Seat,WiFi,Selimut',           '/images/bus.jpg')
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);
    console.log('✅ Buses seeded');

    // ── Routes ────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO routes (origin, destination, distance_km, description) VALUES
      ('Jakarta',    'Bandung',    150, 'Rute Jakarta - Bandung via Tol Cipularang'),
      ('Jakarta',    'Yogyakarta', 560, 'Rute Jakarta - Yogyakarta via Pantura'),
      ('Jakarta',    'Surabaya',   790, 'Rute Jakarta - Surabaya via Pantura'),
      ('Bandung',    'Yogyakarta', 400, 'Rute Bandung - Yogyakarta'),
      ('Yogyakarta', 'Surabaya',   330, 'Rute Yogyakarta - Surabaya'),
      ('Jakarta',    'Semarang',   450, 'Rute Jakarta - Semarang via Tol Trans Jawa'),
      ('Surabaya',   'Bali',       250, 'Rute Surabaya - Bali via Ketapang')
      ON DUPLICATE KEY UPDATE distance_km = VALUES(distance_km);
    `);
    console.log('✅ Routes seeded');

    // ── Schedules ─────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, travel_date, base_price, available_seats) VALUES
      (1, 3, '06:00:00', '09:00:00', CURDATE(),                       85000, 44),
      (1, 1, '08:00:00', '11:00:00', CURDATE(),                      120000, 34),
      (1, 4, '14:00:00', '17:00:00', CURDATE(),                      110000, 34),
      (2, 1, '07:00:00', '14:00:00', CURDATE(),                      250000, 34),
      (2, 2, '18:00:00', '02:00:00', CURDATE(),                      350000, 28),
      (3, 2, '16:00:00', '06:00:00', CURDATE(),                      450000, 28),
      (3, 1, '07:00:00', '20:00:00', CURDATE(),                      320000, 34),
      (4, 4, '09:00:00', '16:00:00', CURDATE(),                      200000, 34),
      (5, 3, '08:00:00', '14:00:00', CURDATE(),                      180000, 44),
      (6, 1, '08:00:00', '16:00:00', CURDATE(),                      220000, 34),
      (7, 2, '08:00:00', '12:00:00', CURDATE(),                      280000, 28),
      (1, 1, '10:00:00', '13:00:00', DATE_ADD(CURDATE(), INTERVAL 1 DAY), 130000, 34),
      (2, 2, '09:00:00', '16:00:00', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 380000, 28)
      ON DUPLICATE KEY UPDATE base_price = VALUES(base_price);
    `);
    console.log('✅ Schedules seeded');

    // ── Promos ────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO promos (code, description, discount_percentage, min_purchase, max_uses, used_count, expired_at, active) VALUES
      ('GOBUS10', 'Diskon 10% untuk semua rute',   10.00,  50000, 100, 5, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1),
      ('HEMAT20', 'Potongan 20% Super Hemat',        20.00, 150000, 100, 2, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 1),
      ('NEWUSER', 'Diskon 15% pengguna baru',        15.00, 100000, 500, 0, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 1)
      ON DUPLICATE KEY UPDATE discount_percentage = VALUES(discount_percentage);
    `);
    console.log('✅ Promos seeded');

    // ── Sample Bookings (so dashboard shows data) ─────────────────
    // Get a valid schedule_id
    const [schRows] = await conn.query('SELECT id FROM schedules LIMIT 3');
    if (schRows.length > 0) {
      const sid1 = schRows[0].id;
      const sid2 = schRows[1] ? schRows[1].id : sid1;
      const sid3 = schRows[2] ? schRows[2].id : sid1;

      await conn.query(`
        INSERT IGNORE INTO bookings
          (booking_code, schedule_id, passenger_name, passenger_phone, passenger_email,
           seat_numbers, total_seats, original_price, discount_amount, total_price,
           payment_status, booking_date)
        VALUES
          ('GBSAMPLE01', ?, 'Budi Santoso',   '081234567890', 'budi@example.com',   'A1',     1, 85000,  0,     85000,  'paid',    NOW() - INTERVAL 3 DAY),
          ('GBSAMPLE02', ?, 'Siti Rahayu',    '081234567891', 'siti@example.com',   'B2,B3',  2, 240000, 24000, 216000, 'paid',    NOW() - INTERVAL 2 DAY),
          ('GBSAMPLE03', ?, 'Ahmad Fauzi',    '081234567892', 'ahmad@example.com',  'C1',     1, 450000, 0,     450000, 'pending', NOW() - INTERVAL 1 DAY),
          ('GBSAMPLE04', ?, 'Dewi Lestari',   '081234567893', 'dewi@example.com',   'A2',     1, 120000, 0,     120000, 'paid',    NOW()),
          ('GBSAMPLE05', ?, 'Rudi Hermawan',  '081234567894', 'rudi@example.com',   'D1,D2',  2, 700000, 70000, 630000, 'paid',    NOW())
      `, [sid1, sid1, sid2, sid2, sid3]);
      console.log('✅ Sample bookings seeded');
    }

  } finally {
    await conn.end();
    console.log('🎉 Seed completed successfully!');
  }
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
