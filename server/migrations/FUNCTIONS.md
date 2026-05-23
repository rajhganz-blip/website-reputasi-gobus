# Database Functions & Stored Procedures

Database GoBus memiliki 2 functions dan 2 procedures yang menghandle bisnis logic kritis.

## Functions

### 1. `CalculateBookingPrice(schedule_id, num_seats, promo_code)`
**Tujuan:** Hitung total harga booking dengan validasi promo dan diskon.

**Input:**
- `schedule_id (INT)` - ID jadwal bus
- `num_seats (INT)` - Jumlah kursi yang dipesan
- `promo_code (VARCHAR)` - Kode promo (nullable)

**Output:** JSON object dengan struktur:
```json
{
  "success": true,
  "original_price": 250000,
  "discount_amount": 50000,
  "total_price": 200000,
  "promo_id": 1,
  "is_valid_promo": true
}
```

**Penggunaan di Node.js:**
```javascript
const [result] = await pool.query(
  'SELECT CalculateBookingPrice(1, 2, "GOBUS10") as pricing'
);
const pricing = JSON.parse(result[0].pricing);
```

---

### 2. `GetAvailableSeats(schedule_id)`
**Tujuan:** Ambil jumlah kursi tersedia (belum locked/booked) untuk schedule.

**Input:**
- `schedule_id (INT)` - ID jadwal bus

**Output:** INT (jumlah kursi tersedia)

**Penggunaan di Node.js:**
```javascript
const [result] = await pool.query(
  'SELECT GetAvailableSeats(1) as available_count'
);
const availableSeats = result[0].available_count;
```

---

## Stored Procedures

### 1. `CreateBookingWithPromo(...)`
**Tujuan:** Create booking secara atomic dengan validasi promo, hitung harga, lock kursi, update usage.

**Input Parameters:**
- `booking_code` - Kode booking unik (format: GBxxxxxx)
- `user_id` - ID user yang booking
- `schedule_id` - ID jadwal bus
- `passenger_name` - Nama penumpang
- `passenger_phone` - No telepon penumpang
- `passenger_email` - Email penumpang
- `seat_numbers` - Nomor kursi (format: A1,A2,A3)
- `num_seats` - Jumlah kursi
- `promo_code` - Kode promo (nullable)

**Output Parameters:**
- `booking_id` - ID booking yang dibuat (NULL jika gagal)
- `message` - Status message

**Penggunaan di Node.js:**
```javascript
const [result] = await pool.query(
  `CALL CreateBookingWithPromo(?, ?, ?, ?, ?, ?, ?, ?, ?, @booking_id, @message)`,
  ['GB000001', 1, 5, 'John Doe', '081234567890', 'john@email.com', 'A1,A2', 2, 'GOBUS10']
);

// Get output parameters
const [outParams] = await pool.query('SELECT @booking_id as booking_id, @message as message');
const bookingId = outParams[0].booking_id;
const message = outParams[0].message;
```

**Fitur:**
- ✅ Atomic transaction (semua atau tidak ada)
- ✅ Validasi schedule aktif
- ✅ Cek ketersediaan kursi
- ✅ Hitung harga dengan promo
- ✅ Lock seats dalam `seats_availability`
- ✅ Update schedule `available_seats`
- ✅ Increment promo usage

---

### 2. `UpdatePromoUsage(booking_id)`
**Tujuan:** Update promo usage count ketika booking berhasil dibayar.

**Input:**
- `booking_id` - ID booking yang dibayar

**Penggunaan di Node.js:**
```javascript
await pool.query('CALL UpdatePromoUsage(?)', [bookingId]);
```

---

## Best Practices

1. **Selalu gunakan `CreateBookingWithPromo`** daripada insert manual untuk booking baru.
2. **Jangan update `used_count` promo secara manual** - gunakan procedure.
3. **Catch error handling** di aplikasi untuk transaction rollback graceful.
4. **Monitor performance** - functions ini berjalan di database; untuk query berat gunakan caching.

---

## Testing

Jalankan test queries di MySQL:

```sql
-- Test CalculateBookingPrice
SELECT CalculateBookingPrice(1, 2, 'GOBUS10') as pricing;

-- Test GetAvailableSeats
SELECT GetAvailableSeats(1) as available;

-- Test CreateBookingWithPromo
CALL CreateBookingWithPromo(
  'GB123456', 1, 1, 'Test User', '081234567890', 
  'test@email.com', 'A1,A2', 2, 'GOBUS10', 
  @booking_id, @message
);
SELECT @booking_id, @message;
```
