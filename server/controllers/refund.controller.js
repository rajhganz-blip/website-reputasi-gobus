const refundService = require('../services/refund.service');

class RefundController {
  async requestRefund(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await refundService.requestRefund(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Pengajuan refund berhasil dikirim. Menunggu verifikasi admin.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getRefunds(req, res, next) {
    try {
      const refunds = await refundService.getRefunds(req.query.status);
      res.json({
        success: true,
        message: 'Daftar pengajuan refund berhasil dimuat!',
        data: refunds
      });
    } catch (err) {
      next(err);
    }
  }

  async approveRefund(req, res, next) {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      await refundService.approveRefund(parseInt(id), admin_notes);
      
      res.json({
        success: true,
        message: 'Pengajuan refund berhasil DISETUJUI. Dana dikembalikan dan kursi dibebaskan.'
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectRefund(req, res, next) {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      await refundService.rejectRefund(parseInt(id), admin_notes);
      
      res.json({
        success: true,
        message: 'Pengajuan refund DITOLAK. Tiket dikembalikan ke status lunas.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RefundController();
