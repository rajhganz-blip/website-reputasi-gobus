const { z } = require('zod');

const createPromoSchema = z.object({
  code: z.string().min(3, { message: 'Kode promo minimal 3 karakter' }).max(50),
  description: z.string().max(255).optional(),
  discount_percentage: z.number().min(0).max(100, { message: 'Diskon maksimal 100%' }),
  min_purchase: z.number().min(0).optional().default(0),
  max_uses: z.number().int().min(1).optional().default(100),
  expired_at: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, { message: 'Format tanggal expired salah' }),
  active: z.number().int().min(0).max(1).optional().default(1)
});

module.exports = {
  createPromoSchema
};
