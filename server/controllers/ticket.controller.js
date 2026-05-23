const bookingService = require('../services/booking.service');
const { generateTicketPDF } = require('../utils/pdf');
const { BadRequestError } = require('../utils/customError');

class TicketController {
  async getTicketDetail(req, res, next) {
    try {
      const { bookingCode } = req.params;
      const ticket = await bookingService.getBookingDetail(bookingCode);
      
      res.json({
        success: true,
        message: 'Tiket berhasil dimuat!',
        data: ticket
      });
    } catch (err) {
      next(err);
    }
  }

  async downloadTicketPDF(req, res, next) {
    try {
      const { bookingCode } = req.params;
      const ticket = await bookingService.getBookingDetail(bookingCode);

      // Verify booking is paid before allowing e-ticket export
      if (ticket.payment_status !== 'paid') {
        throw new BadRequestError('Harap selesaikan pembayaran terlebih dahulu sebelum mengunduh E-Ticket');
      }

      // Configure PDF download headers
      res.setHeader('Content-disposition', `attachment; filename=GoBus-Ticket-${bookingCode}.pdf`);
      res.setHeader('Content-type', 'application/pdf');

      // Streams generated PDF straight to Express HTTP response
      await generateTicketPDF(ticket, res);
    } catch (err) {
      next(err);
    }
  }

  async verifyTicket(req, res, next) {
    try {
      const { bookingCode } = req.params;
      const ticket = await bookingService.getBookingDetail(bookingCode);
      
      res.json({
        success: true,
        message: ticket.payment_status === 'paid' 
          ? '✅ E-TICKET VALID - Silakan lakukan boarding' 
          : '❌ TIKET BELUM LUNAS / TIDAK VALID',
        data: {
          booking_code: ticket.booking_code,
          passenger_name: ticket.passenger_name,
          route: `${ticket.origin} - ${ticket.destination}`,
          date: ticket.travel_date,
          seats: ticket.seat_numbers,
          payment_status: ticket.payment_status
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TicketController();
