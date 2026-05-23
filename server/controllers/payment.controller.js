const paymentService = require('../services/payment.service');

class PaymentController {
  async createPaymentToken(req, res, next) {
    try {
      const { booking_code } = req.body;
      const result = await paymentService.createPaymentToken(booking_code);
      res.json({
        success: true,
        message: 'Token Snap Midtrans berhasil dibuat!',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      await paymentService.handleWebhook(req.body);
      res.status(200).json({
        success: true,
        message: 'Webhook Midtrans diproses dengan sukses'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PaymentController();
