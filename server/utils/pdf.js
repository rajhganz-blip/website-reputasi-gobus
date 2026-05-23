const PDFDocument = require('pdfkit');
const { generateQR } = require('./qr');

async function generateTicketPDF(ticketData, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });

      // Stream directly to response
      doc.pipe(res);

      // Header Banner
      doc.rect(0, 0, doc.page.width, 120)
         .fill('#0f172a'); // sleek dark slate background

      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('GoBus E-TICKET', 50, 40);

      doc.fillColor('#38bdf8') // light blue accent
         .fontSize(12)
         .text('Perjalanan Aman dan Nyaman Bersama GoBus', 50, 75);

      // Reset text settings
      doc.fillColor('#334155');

      // Booking Code & Status Box
      doc.rect(400, 30, 160, 65)
         .lineWidth(1)
         .stroke('#38bdf8');

      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica')
         .text('KODE BOOKING', 410, 40)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(ticketData.booking_code, 410, 55);

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(ticketData.payment_status === 'paid' ? '#22c55e' : '#f59e0b')
         .text(ticketData.payment_status.toUpperCase(), 410, 78);

      // Ticket content layout
      doc.y = 150;

      // Section 1: Trip Info
      doc.fillColor('#0f172a')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Informasi Perjalanan', 50, doc.y);

      doc.lineWidth(1)
         .moveTo(50, doc.y + 20)
         .lineTo(550, doc.y + 20)
         .strokeColor('#cbd5e1')
         .stroke();

      doc.y += 30;

      // Grid for trip info
      const col1_x = 50;
      const col2_x = 300;
      let currentY = doc.y;

      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Operator / Bus', col1_x, currentY);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(ticketData.bus_name, col1_x, currentY + 15);
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Kelas Bus', col1_x, currentY + 35);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(ticketData.bus_class, col1_x, currentY + 48);

      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Rute Perjalanan', col2_x, currentY);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(`${ticketData.origin} ➔ ${ticketData.destination}`, col2_x, currentY + 15);
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Tanggal Keberangkatan', col2_x, currentY + 35);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(new Date(ticketData.travel_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), col2_x, currentY + 48);

      currentY += 80;
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Waktu Keberangkatan', col1_x, currentY);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(ticketData.departure_time.substring(0, 5) + ' WIB', col1_x, currentY + 15);

      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Estimasi Tiba', col2_x, currentY);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(ticketData.arrival_time.substring(0, 5) + ' WIB', col2_x, currentY + 15);

      // Section 2: Passengers & Seats
      currentY += 50;
      doc.y = currentY;

      doc.fillColor('#0f172a')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Detail Penumpang', 50, doc.y);

      doc.lineWidth(1)
         .moveTo(50, doc.y + 20)
         .lineTo(550, doc.y + 20)
         .strokeColor('#cbd5e1')
         .stroke();

      currentY += 30;
      
      // Draw Table Header
      doc.rect(50, currentY, 500, 20).fill('#f1f5f9');
      doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
      doc.text('NO.', 60, currentY + 5);
      doc.text('NAMA PENUMPANG', 100, currentY + 5);
      doc.text('NO. IDENTITAS', 300, currentY + 5);
      doc.text('NOMOR KURSI', 450, currentY + 5);

      // Render actual passenger details
      // If we have detailed passengers array, map it. Otherwise use the single passenger data from booking table
      const passengersList = ticketData.passengers && ticketData.passengers.length > 0 
        ? ticketData.passengers 
        : [{ name: ticketData.passenger_name, id_number: ticketData.passenger_id_number || '-', seat_number: ticketData.seat_numbers }];

      doc.fillColor('#334155').font('Helvetica').fontSize(10);
      let tableY = currentY + 20;
      passengersList.forEach((p, index) => {
        // Draw row background for alternating rows
        if (index % 2 === 1) {
          doc.rect(50, tableY, 500, 20).fill('#f8fafc');
          doc.fillColor('#334155');
        }
        doc.text(String(index + 1), 60, tableY + 5);
        doc.text(p.name, 100, tableY + 5);
        doc.text(p.id_number || '-', 300, tableY + 5);
        doc.text(p.seat_number, 450, tableY + 5);
        tableY += 20;
      });

      // Section 3: QR Code & Verification
      tableY += 40;
      doc.y = tableY;

      doc.lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .strokeColor('#cbd5e1')
         .stroke();

      // Generate base64 QR Code string
      const qrData = `https://gobus.com/api/ticket/verify/${ticketData.booking_code}`;
      const qrDataUrl = await generateQR(qrData);

      // Add QR Image to PDF
      doc.image(qrDataUrl, 380, doc.y + 20, { width: 140, height: 140 });

      // Terms and conditions on the left of QR
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('Ketentuan Penting:', 50, doc.y + 20);
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica');
      
      const terms = [
        '1. Tunjukkan E-Ticket ini pada loket keberangkatan saat check-in.',
        '2. Harap tiba di titik keberangkatan minimal 30 menit sebelum jadwal.',
        '3. Tiket yang sudah dibeli tidak dapat dibatalkan di luar masa tenggang.',
        '4. Manajemen GoBus tidak bertanggung jawab atas barang berharga yang hilang.',
        '5. Pindai kode QR di sebelah kanan untuk verifikasi keabsahan e-ticket.'
      ];

      let termY = doc.y + 40;
      terms.forEach(t => {
        doc.text(t, 50, termY, { width: 300 });
        termY += 20;
      });

      // Footer
      doc.fillColor('#94a3b8')
         .fontSize(9)
         .font('Helvetica-Oblique')
         .text('Terima kasih telah bepergian dengan GoBus!', 50, 720, { align: 'center', width: 500 });

      doc.end();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateTicketPDF
};
