const { z } = require('zod');

const registerSchema = z.object({
  username: z.string()
    .min(3, { message: 'Username minimal 3 karakter' })
    .max(50, { message: 'Username maksimal 50 karakter' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username hanya boleh huruf, angka, dan underscore' }),
  password: z.string()
    .min(6, { message: 'Password minimal 6 karakter' })
    .max(100, { message: 'Password terlalu panjang' }),
  name: z.string()
    .min(1, { message: 'Nama lengkap wajib diisi' })
    .max(100, { message: 'Nama lengkap maksimal 100 karakter' }),
  email: z.string()
    .email({ message: 'Format email tidak valid' }),
  phone: z.string()
    .min(9, { message: 'Nomor telepon minimal 9 digit' })
    .max(20, { message: 'Nomor telepon maksimal 20 digit' })
    .regex(/^[+0-9]+$/, { message: 'Format nomor telepon tidak valid' })
    .optional().or(z.literal(''))
});

const loginSchema = z.object({
  username: z.string().min(1, { message: 'Username wajib diisi' }),
  password: z.string().min(1, { message: 'Password wajib diisi' })
});

module.exports = {
  registerSchema,
  loginSchema
};
