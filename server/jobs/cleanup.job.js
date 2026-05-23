const cron = require('node-cron');
const seatService = require('../services/seat.service');
const bookingService = require('../services/booking.service');
const logger = require('../utils/logger');

function initJobs() {
  logger.info('⏰ Initializing system cron jobs...');

  // 1. Clean up expired seat locks every minute
  cron.schedule('* * * * *', async () => {
    logger.debug('Running expired seat locks cleanup job...');
    await seatService.cleanupExpiredLocks();
  });

  // 2. Clean up expired pending bookings every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.debug('Running expired bookings payment cleanup job...');
    await bookingService.checkExpiredBookings();
  });

  logger.info('✅ Automated system cron jobs scheduled successfully');
}

module.exports = {
  initJobs
};
