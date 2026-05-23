const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/create', verifyToken, paymentController.createPaymentToken);
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
