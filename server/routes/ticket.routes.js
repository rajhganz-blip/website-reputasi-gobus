const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');

router.get('/:bookingCode', ticketController.getTicketDetail);
router.get('/:bookingCode/pdf', ticketController.downloadTicketPDF);
router.get('/verify/:bookingCode', ticketController.verifyTicket);

module.exports = router;
