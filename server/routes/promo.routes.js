const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promo.controller');

router.get('/', promoController.getActivePromos);
router.post('/validate', promoController.validatePromo);

module.exports = router;
