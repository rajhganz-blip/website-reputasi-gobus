const seatService = require('../services/seat.service');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

function initSocket(io) {
  // 1. Subscribe to SeatService events to broadcast changes to relevant rooms
  seatService.on('seat:locked', ({ scheduleId, seats, userId, expiryTime }) => {
    logger.info(`Socket Broadcast: seats locked [${seats.join(', ')}] on schedule ${scheduleId}`);
    io.to(`schedule_${scheduleId}`).emit('seat:locked', { seats, userId, expiryTime });
  });

  seatService.on('seat:released', ({ scheduleId, seats, userId }) => {
    logger.info(`Socket Broadcast: seats released [${seats.join(', ')}] on schedule ${scheduleId}`);
    io.to(`schedule_${scheduleId}`).emit('seat:released', { seats, userId });
  });

  seatService.on('seat:booked', ({ scheduleId, seats, bookingId }) => {
    logger.info(`Socket Broadcast: seats booked permanently [${seats.join(', ')}] on schedule ${scheduleId}`);
    io.to(`schedule_${scheduleId}`).emit('seat:booked', { seats, bookingId });
  });

  // 2. Subscribe to NotificationService events to route alerts to specific user private rooms
  notificationService.on('notification:created', (notification) => {
    logger.info(`Socket Push: Sending notification to user_${notification.userId}`);
    io.to(`user_${notification.userId}`).emit('notification', notification);
  });

  // 3. Socket.IO Connection Setup
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Client joins a specific schedule room to listen for seat locks
    socket.on('join:schedule', (scheduleId) => {
      socket.join(`schedule_${scheduleId}`);
      logger.info(`Socket ${socket.id} joined schedule_${scheduleId} room`);
    });

    // Client leaves a schedule room
    socket.on('leave:schedule', (scheduleId) => {
      socket.leave(`schedule_${scheduleId}`);
      logger.info(`Socket ${socket.id} left schedule_${scheduleId} room`);
    });

    // Client registers their authenticated session to receive direct notification alerts
    socket.on('authenticate', (userId) => {
      socket.join(`user_${userId}`);
      logger.info(`Socket ${socket.id} authenticated for user_${userId}`);
    });

    // Event: User selects/locks seats
    socket.on('seat:select', async ({ scheduleId, seatNumbers, userId }) => {
      try {
        const result = await seatService.lockSeats(scheduleId, seatNumbers, userId);
        socket.emit('seat:select:success', result);
      } catch (err) {
        socket.emit('seat:select:error', { message: err.message });
      }
    });

    // Event: User releases seats
    socket.on('seat:release', async ({ scheduleId, seatNumbers, userId }) => {
      try {
        const result = await seatService.releaseSeats(scheduleId, seatNumbers, userId);
        socket.emit('seat:release:success', result);
      } catch (err) {
        socket.emit('seat:release:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = {
  initSocket
};
