require('dotenv').config();

module.exports = {
  accessSecret: process.env.JWT_ACCESS_SECRET || 'gobus_access_secret_key_2026_secure_key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'gobus_refresh_secret_key_2026_secure_key',
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
};
