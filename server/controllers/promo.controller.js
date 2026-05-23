const promoService = require('../services/promo.service');

class PromoController {
  async getActivePromos(req, res, next) {
    try {
      const promos = await promoService.getActivePromos();
      res.json({
        success: true,
        message: 'Daftar promo aktif berhasil dimuat!',
        data: promos
      });
    } catch (err) {
      next(err);
    }
  }

  async validatePromo(req, res, next) {
    try {
      const { code, amount } = req.body;
      const result = await promoService.validatePromo(code, amount);
      res.json({
        success: true,
        message: 'Kode promo berhasil diverifikasi!',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async createPromo(req, res, next) {
    try {
      const promo = await promoService.createPromo(req.body);
      res.status(201).json({
        success: true,
        message: 'Kode promo baru berhasil dibuat!',
        data: promo
      });
    } catch (err) {
      next(err);
    }
  }

  async updatePromo(req, res, next) {
    try {
      const promo = await promoService.updatePromo(parseInt(req.params.id), req.body);
      res.json({
        success: true,
        message: 'Kode promo berhasil diperbarui!',
        data: promo
      });
    } catch (err) {
      next(err);
    }
  }

  async deletePromo(req, res, next) {
    try {
      await promoService.deletePromo(parseInt(req.params.id));
      res.json({
        success: true,
        message: 'Promo berhasil dihapus (Dinonaktifkan)!'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PromoController();
