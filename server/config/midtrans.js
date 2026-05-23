const midtransClient = require('midtrans-client');
require('dotenv').config();

const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-abc123xyz',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-abc123xyz'
});

module.exports = {
  snap,
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-abc123xyz',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-abc123xyz',
  merchantId: process.env.MIDTRANS_MERCHANT_ID || 'G123456789'
};
