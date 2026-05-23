const { z } = require('zod');

const createBookingSchema = z.object({
  schedule_id: z.number({ required_error: 'Jadwal ID wajib diisi' }),
  passenger_name: z.string().min(1, { message: 'Nama kontak pemesan wajib diisi' }),
  passenger_phone: z.string().min(9, { message: 'No HP pemesan wajib diisi' }),
  passenger_email: z.string().email({ message: 'Email pemesan tidak valid' }),
  passenger_id_number: z.string().optional().or(z.literal('')),
  seat_numbers: z.string().min(1, { message: 'Kursi wajib dipilih' }), // e.g. "A1,A2"
  promo_code: z.string().optional().or(z.literal('')),
  
  // Detailed passenger listings
  passengers: z.array(z.object({
    name: z.string().min(1, { message: 'Nama penumpang wajib diisi' }),
    id_number: z.string().min(5, { message: 'No Identitas penumpang wajib diisi (Min 5 digit)' }),
    seat_number: z.string().min(1, { message: 'No Kursi penumpang wajib diisi' })
  })).min(1, { message: 'Daftar data penumpang wajib diisi' })
});

module.exports = {
  createBookingSchema
};
