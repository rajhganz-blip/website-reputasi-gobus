const { z } = require('zod');

const searchScheduleSchema = z.object({
  origin: z.string().min(1, { message: 'Asal kota wajib diisi' }),
  destination: z.string().min(1, { message: 'Tujuan kota wajib diisi' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD' }),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  operator: z.string().optional(),
  facilities: z.string().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'time_asc', 'time_desc']).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

const createScheduleSchema = z.object({
  route_id: z.number({ required_error: 'Rute ID wajib diisi' }),
  bus_id: z.number({ required_error: 'Bus ID wajib diisi' }),
  departure_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Format jam keberangkatan harus HH:MM atau HH:MM:SS' }),
  arrival_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Format jam tiba harus HH:MM atau HH:MM:SS' }),
  travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD' }),
  base_price: z.number().min(0, { message: 'Harga tiket tidak boleh negatif' })
});

module.exports = {
  searchScheduleSchema,
  createScheduleSchema
};
