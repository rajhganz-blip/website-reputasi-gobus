const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refund.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/request', verifyToken, refundController.requestRefund);

module.exports = router;
