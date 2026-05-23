const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const { connectDB } = require('./config/db');
const { initSocket } = require('./sockets/seat.socket');
const { initJobs } = require('./jobs/cleanup.job');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const ticketRoutes = require('./routes/ticket.routes');
const adminRoutes = require('./routes/admin.routes');
const promoRoutes = require('./routes/promo.routes');
const refundRoutes = require('./routes/refund.routes');
const userRoutes = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security configuration
// Helmet security headers
const isProd = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: isProd ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration - restrict origin in production
const allowedOrigin = process.env.SOCKET_CORS_ORIGIN || (isProd ? '' : '*');
app.use(cors({
  origin: allowedOrigin || '*',
  credentials: true
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiting
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date() });
});

// Serve uploads directory
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Serve Frontend static assets from public/ folder at root
app.use(express.static(path.join(__dirname, '../public')));

// Mounting API Routes
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/user', userRoutes);

// SPA routing fallback (Serves index.html at root for all page hits)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Centralized error handling
app.use(errorHandler);

// HTTP & Socket Server Setup
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize database and start servers
async function startServer() {
  try {
    // 1. Establish Database Pool and Verify Connectivity
    await connectDB();

    // 2. Initialize socket listeners
    initSocket(io);

    // 3. Fire up Cron Cleanups
    initJobs();

    // 4. Start listening
    server.listen(PORT, () => {
      logger.info(`🚌 GoBus server running at http://localhost:${PORT}`);
      logger.info(`📊 Admin Portal Access: http://localhost:${PORT}/admin.html`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      try {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        server.close(() => logger.info('HTTP server closed'));
        // close DB pool if available
        try {
          const { getPool } = require('./config/db');
          const pool = getPool();
          if (pool && pool.end) await pool.end();
          logger.info('DB pool closed');
        } catch (e) {
          logger.warn('DB pool close error or not initialized');
        }
        // allow some time for cleanup
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        logger.error('Error during shutdown', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
