const { getPool } = require('../config/db');
const { BadRequestError, NotFoundError } = require('../utils/customError');

class PromoService {
  async getActivePromos() {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT id, code, description, discount_percentage, min_purchase, expired_at
      FROM promos 
      WHERE active = 1 AND expired_at >= NOW() AND used_count < max_uses
      ORDER BY created_at DESC
    `);
    return rows;
  }

  async validatePromo(code, purchaseAmount, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.query(`
      SELECT * FROM promos 
      WHERE code = ? AND active = 1 AND expired_at >= NOW()
      FOR UPDATE
    `, [code]);

    if (rows.length === 0) {
      throw new BadRequestError('Kode promo tidak valid atau sudah kadaluarsa');
    }

    const promo = rows[0];

    // Check usage limits
    if (promo.used_count >= promo.max_uses) {
      throw new BadRequestError('Kuota kode promo ini sudah habis');
    }

    // Check minimum purchase amount
    if (parseFloat(purchaseAmount) < parseFloat(promo.min_purchase)) {
      throw new BadRequestError(
        `Pembelian minimal untuk menggunakan promo ini adalah Rp ${parseFloat(promo.min_purchase).toLocaleString('id-ID')}`
      );
    }

    // Calculate discount amount
    const discount = (parseFloat(purchaseAmount) * parseFloat(promo.discount_percentage)) / 100;

    return {
      id: promo.id,
      code: promo.code,
      discount_percentage: promo.discount_percentage,
      discount: parseFloat(discount.toFixed(2))
    };
  }

  async createPromo(data) {
    const pool = getPool();
    const { code, description, discount_percentage, min_purchase, max_uses, expired_at, active = 1 } = data;

    const [result] = await pool.query(`
      INSERT INTO promos (code, description, discount_percentage, min_purchase, max_uses, expired_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [code.toUpperCase(), description || null, discount_percentage, min_purchase || 0, max_uses || 100, expired_at, active]);

    return { id: result.insertId, ...data };
  }

  async updatePromo(id, data) {
    const pool = getPool();
    
    // Check if exists
    const [existing] = await pool.query('SELECT id FROM promos WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('Promo tidak ditemukan');
    }

    const { code, description, discount_percentage, min_purchase, max_uses, expired_at, active } = data;

    await pool.query(`
      UPDATE promos 
      SET code = ?, description = ?, discount_percentage = ?, min_purchase = ?, max_uses = ?, expired_at = ?, active = ?
      WHERE id = ?
    `, [code.toUpperCase(), description || null, discount_percentage, min_purchase || 0, max_uses || 100, expired_at, active, id]);

    return { id, ...data };
  }

  async deletePromo(id) {
    const pool = getPool();
    const [existing] = await pool.query('SELECT id FROM promos WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('Promo tidak ditemukan');
    }

    // Soft delete by making it inactive
    await pool.query('UPDATE promos SET active = 0 WHERE id = ?', [id]);
    return true;
  }
}

module.exports = new PromoService();
