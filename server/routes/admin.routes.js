const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const adminController = require('../controllers/admin.controller');
const authController = require('../controllers/auth.controller');
const { verifyToken, verifyAdmin } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter');

// File upload config for QRIS
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `qris_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── PUBLIC: Admin Login (rate limited, no token required) ────
router.post('/login', authLimiter, authController.adminLogin);

// ─── PROTECTED: All routes below require admin token ──────────
router.use(verifyToken, verifyAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboardAnalytics);
router.get('/stats', adminController.getStats);

// Bookings
router.get('/bookings', adminController.getBookings);
router.post('/confirm-payment', adminController.confirmPayment);

// Routes CRUD
router.get('/routes', adminController.getRoutes);
router.post('/routes', adminController.createRoute);
router.put('/routes/:id', adminController.updateRoute);
router.delete('/routes/:id', adminController.deleteRoute);

// Buses
router.get('/buses', adminController.getBuses);

// Schedules CRUD
router.get('/schedules', adminController.getSchedules);
router.post('/schedules', adminController.createSchedule);
router.put('/schedules/:id', adminController.updateSchedule);
router.delete('/schedules/:id', adminController.deleteSchedule);

// Discounts CRUD
router.get('/discounts', adminController.getDiscounts);
router.post('/discounts', adminController.createDiscount);
router.put('/discounts/:id', adminController.updateDiscount);

// Revenue
router.get('/revenue', adminController.getRevenue);

// QRIS Upload
router.post('/qris', upload.single('qris'), adminController.uploadQris);

module.exports = router;
