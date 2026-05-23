-- =============================================
-- GoBus Optimized Database Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS gobus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gobus;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  role ENUM('customer', 'admin') DEFAULT 'customer',
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email (email)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Routes Table
CREATE TABLE IF NOT EXISTS routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance_km INT DEFAULT 0,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_routes_search (origin, destination)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Buses Table
CREATE TABLE IF NOT EXISTS buses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  bus_class ENUM('Economy', 'Executive', 'Super Executive') DEFAULT 'Economy',
  total_seats INT DEFAULT 40,
  facilities TEXT,
  image_url VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  bus_id INT NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  travel_date DATE NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  available_seats INT DEFAULT 40,
  status ENUM('active', 'cancelled', 'completed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  INDEX idx_schedules_search (route_id, travel_date, status),
  INDEX idx_schedules_date (travel_date)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Promos Table (Promo System)
CREATE TABLE IF NOT EXISTS promos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  discount_percentage DECIMAL(5,2) NOT NULL,
  min_purchase DECIMAL(10,2) DEFAULT 0,
  max_uses INT DEFAULT 100,
  used_count INT DEFAULT 0,
  expired_at DATETIME NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_promos_code (code, active)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(20) UNIQUE NOT NULL,
  user_id INT,
  schedule_id INT NOT NULL,
  passenger_name VARCHAR(100) NOT NULL,
  passenger_phone VARCHAR(20) NOT NULL,
  passenger_email VARCHAR(100) NOT NULL,
  passenger_id_number VARCHAR(50),
  seat_numbers VARCHAR(255) NOT NULL,
  total_seats INT DEFAULT 1,
  promo_id INT,
  original_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending', 'paid', 'failed', 'refunded', 'refund_requested') DEFAULT 'pending',
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expired_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE SET NULL,
  INDEX idx_bookings_code (booking_code),
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_status (payment_status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. Passengers Table
CREATE TABLE IF NOT EXISTS passengers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  id_number VARCHAR(50),
  seat_number VARCHAR(10) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_passengers_booking (booking_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. Payments Table (Midtrans Snap Integration)
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  transaction_id VARCHAR(100) UNIQUE,
  snap_token VARCHAR(255),
  payment_method VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending', 'settlement', 'expire', 'deny', 'cancel') DEFAULT 'pending',
  payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_payments_booking (booking_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 9. Refunds Table (Refund System)
CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  bank_name VARCHAR(50) NOT NULL,
  bank_account VARCHAR(50) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refunds_booking (booking_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 10. Notifications Table (Notification System)
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  read_status TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 11. Seats Availability Table (Seat Locking Realtime)
CREATE TABLE IF NOT EXISTS seats_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  seat_number VARCHAR(10) NOT NULL,
  status ENUM('locked', 'booked') NOT NULL,
  locked_by_user_id INT NULL,
  locked_until TIMESTAMP NULL,
  booking_id INT NULL,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (locked_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_schedule_seat (schedule_id, seat_number),
  INDEX idx_seats_expiry (locked_until, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================
-- SEED DATA
-- =============================================

-- Seed routes
INSERT INTO routes (origin, destination, distance_km, description) VALUES 
('Jakarta', 'Bandung', 150, 'Rute Jakarta - Bandung via Tol Cipularang'),
('Jakarta', 'Yogyakarta', 560, 'Rute Jakarta - Yogyakarta via Pantura'),
('Jakarta', 'Surabaya', 790, 'Rute Jakarta - Surabaya via Pantura'),
('Bandung', 'Yogyakarta', 400, 'Rute Bandung - Yogyakarta'),
('Yogyakarta', 'Surabaya', 330, 'Rute Yogyakarta - Surabaya'),
('Jakarta', 'Semarang', 450, 'Rute Jakarta - Semarang via Tol Trans Jawa'),
('Surabaya', 'Bali', 250, 'Rute Surabaya - Bali via Ketapang')
ON DUPLICATE KEY UPDATE distance_km=distance_km;

-- Seed buses
INSERT INTO buses (id, name, bus_class, total_seats, facilities, image_url) VALUES
(1, 'Rosalia Indah Executive', 'Executive', 34, 'AC,Reclining Seat,WiFi,Selimut,Bantal', '/images/bus.jpg'),
(2, 'Sumber Alam Super Exec', 'Super Executive', 28, 'AC,Full Reclining,WiFi,Makan,Toilet', '/images/bus.jpg'),
(3, 'PO Haryanto Economy', 'Economy', 44, 'AC,Reclining Seat', '/images/bus.jpg'),
(4, 'Kramat Djati Executive', 'Executive', 34, 'AC,Reclining Seat,WiFi,Selimut', '/images/bus.jpg')
ON DUPLICATE KEY UPDATE name=name;

-- Seed schedules
INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, travel_date, base_price, available_seats) VALUES
(1, 3, '06:00:00', '09:00:00', CURDATE(), 85000, 44),
(1, 1, '08:00:00', '11:00:00', CURDATE(), 120000, 34),
(1, 4, '14:00:00', '17:00:00', CURDATE(), 110000, 34),
(2, 1, '07:00:00', '14:00:00', CURDATE(), 250000, 34),
(2, 2, '18:00:00', '02:00:00', CURDATE(), 350000, 28),
(3, 2, '16:00:00', '06:00:00', CURDATE(), 450000, 28),
(3, 1, '07:00:00', '20:00:00', CURDATE(), 320000, 34),
(4, 4, '09:00:00', '16:00:00', CURDATE(), 200000, 34),
(5, 3, '08:00:00', '14:00:00', CURDATE(), 180000, 44),
(6, 1, '08:00:00', '16:00:00', CURDATE(), 220000, 34),
(7, 2, '08:00:00', '12:00:00', CURDATE(), 280000, 28)
ON DUPLICATE KEY UPDATE base_price=base_price;

-- Seed promos
INSERT INTO promos (code, description, discount_percentage, min_purchase, max_uses, used_count, expired_at, active) VALUES
('GOBUS10', 'Diskon 10% untuk semua rute', 10.00, 50000, 100, 0, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1),
('HEMAT20', 'Potongan 20% Super Hemat', 20.00, 150000, 100, 0, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 1),
('NEWUSER', 'Diskon 15% pengguna baru', 15.00, 100000, 500, 0, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 1)
ON DUPLICATE KEY UPDATE discount_percentage=discount_percentage;

-- =============================================
-- STORED FUNCTIONS & PROCEDURES
-- =============================================

-- FUNCTION 1: CalculateBookingPrice
-- Hitung total harga booking dengan validasi promo dan hitung diskon
DELIMITER $$
CREATE FUNCTION IF NOT EXISTS CalculateBookingPrice(
  p_schedule_id INT,
  p_num_seats INT,
  p_promo_code VARCHAR(50)
) RETURNS JSON
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_base_price DECIMAL(10,2);
  DECLARE v_original_total DECIMAL(10,2);
  DECLARE v_discount_amount DECIMAL(10,2) DEFAULT 0;
  DECLARE v_final_price DECIMAL(10,2);
  DECLARE v_promo_id INT;
  DECLARE v_discount_percentage DECIMAL(5,2) DEFAULT 0;
  DECLARE v_min_purchase DECIMAL(10,2) DEFAULT 0;
  DECLARE v_is_valid BOOLEAN DEFAULT FALSE;
  
  -- Get base price from schedule
  SELECT base_price INTO v_base_price FROM schedules WHERE id = p_schedule_id;
  
  IF v_base_price IS NULL THEN
    RETURN JSON_OBJECT('success', FALSE, 'message', 'Schedule not found');
  END IF;
  
  SET v_original_total = v_base_price * p_num_seats;
  
  -- Validate and get promo details if provided
  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    SELECT id, discount_percentage, min_purchase 
    INTO v_promo_id, v_discount_percentage, v_min_purchase
    FROM promos 
    WHERE code = p_promo_code 
      AND active = 1 
      AND expired_at > NOW() 
      AND used_count < max_uses
    LIMIT 1;
    
    IF v_promo_id IS NOT NULL AND v_original_total >= v_min_purchase THEN
      SET v_is_valid = TRUE;
      SET v_discount_amount = (v_original_total * v_discount_percentage) / 100;
    END IF;
  END IF;
  
  SET v_final_price = v_original_total - v_discount_amount;
  
  RETURN JSON_OBJECT(
    'success', TRUE,
    'original_price', v_original_total,
    'discount_amount', v_discount_amount,
    'total_price', v_final_price,
    'promo_id', v_promo_id,
    'is_valid_promo', v_is_valid
  );
END$$
DELIMITER ;

-- FUNCTION 2: GetAvailableSeats
-- Ambil jumlah kursi tersedia untuk schedule tertentu
DELIMITER $$
CREATE FUNCTION IF NOT EXISTS GetAvailableSeats(
  p_schedule_id INT
) RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_available INT;
  
  SELECT COUNT(*) INTO v_available
  FROM seats_availability 
  WHERE schedule_id = p_schedule_id 
    AND status NOT IN ('locked', 'booked')
    AND (locked_until IS NULL OR locked_until < NOW());
  
  RETURN COALESCE(v_available, 0);
END$$
DELIMITER ;

-- PROCEDURE 1: CreateBookingWithPromo
-- Create booking dengan validasi promo dan update kursi secara atomic
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS CreateBookingWithPromo(
  IN p_booking_code VARCHAR(20),
  IN p_user_id INT,
  IN p_schedule_id INT,
  IN p_passenger_name VARCHAR(100),
  IN p_passenger_phone VARCHAR(20),
  IN p_passenger_email VARCHAR(100),
  IN p_seat_numbers VARCHAR(255),
  IN p_num_seats INT,
  IN p_promo_code VARCHAR(50),
  OUT p_booking_id INT,
  OUT p_message VARCHAR(255)
)
BEGIN
  DECLARE v_promo_id INT;
  DECLARE v_original_price DECIMAL(10,2);
  DECLARE v_discount_amount DECIMAL(10,2);
  DECLARE v_total_price DECIMAL(10,2);
  DECLARE v_available_seats INT;
  
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_message = 'Database error occurred';
    SET p_booking_id = NULL;
  END;
  
  START TRANSACTION;
  
  -- Validate schedule exists and is active
  IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = p_schedule_id AND status = 'active') THEN
    SET p_message = 'Schedule not found or inactive';
    ROLLBACK;
    SET p_booking_id = NULL;
    LEAVE;
  END IF;
  
  -- Check available seats
  SET v_available_seats = GetAvailableSeats(p_schedule_id);
  IF v_available_seats < p_num_seats THEN
    SET p_message = CONCAT('Not enough seats. Available: ', v_available_seats);
    ROLLBACK;
    SET p_booking_id = NULL;
    LEAVE;
  END IF;
  
  -- Calculate pricing with promo
  SET @price_json = CalculateBookingPrice(p_schedule_id, p_num_seats, p_promo_code);
  SET v_original_price = JSON_EXTRACT(@price_json, '$.original_price');
  SET v_discount_amount = JSON_EXTRACT(@price_json, '$.discount_amount');
  SET v_total_price = JSON_EXTRACT(@price_json, '$.total_price');
  SET v_promo_id = JSON_EXTRACT(@price_json, '$.promo_id');
  
  -- Insert booking
  INSERT INTO bookings (
    booking_code, user_id, schedule_id, passenger_name, 
    passenger_phone, passenger_email, seat_numbers, total_seats,
    promo_id, original_price, discount_amount, total_price,
    expired_at
  ) VALUES (
    p_booking_code, p_user_id, p_schedule_id, p_passenger_name,
    p_passenger_phone, p_passenger_email, p_seat_numbers, p_num_seats,
    v_promo_id, v_original_price, v_discount_amount, v_total_price,
    DATE_ADD(NOW(), INTERVAL 30 MINUTE)
  );
  
  SET p_booking_id = LAST_INSERT_ID();
  
  -- Update promo usage if applied
  IF v_promo_id IS NOT NULL THEN
    UPDATE promos SET used_count = used_count + 1 WHERE id = v_promo_id;
  END IF;
  
  -- Lock seats in seats_availability
  INSERT IGNORE INTO seats_availability (schedule_id, seat_number, status, locked_by_user_id, locked_until, booking_id)
  SELECT p_schedule_id, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p_seat_numbers, ',', numbers.n), ',', -1)) as seat,
         'locked', p_user_id, DATE_ADD(NOW(), INTERVAL 30 MINUTE), p_booking_id
  FROM (
    SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
    UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  ) numbers
  WHERE numbers.n <= (LENGTH(p_seat_numbers) - LENGTH(REPLACE(p_seat_numbers, ',', '')) + 1);
  
  -- Update available_seats in schedules
  UPDATE schedules 
  SET available_seats = available_seats - p_num_seats 
  WHERE id = p_schedule_id;
  
  SET p_message = 'Booking created successfully';
  COMMIT;
END$$
DELIMITER ;

-- PROCEDURE 2: UpdatePromoUsage
-- Update promo usage count ketika booking paid
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS UpdatePromoUsage(
  IN p_booking_id INT
)
BEGIN
  DECLARE v_promo_id INT;
  
  SELECT promo_id INTO v_promo_id FROM bookings WHERE id = p_booking_id;
  
  IF v_promo_id IS NOT NULL THEN
    UPDATE promos 
    SET used_count = used_count + 1 
    WHERE id = v_promo_id AND used_count < max_uses;
  END IF;
END$$
DELIMITER ;
