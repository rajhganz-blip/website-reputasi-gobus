const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification.service');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/notifications', verifyToken, async (req, res, next) => {
  try {
    const list = await notificationService.getUserNotifications(req.user.id);
    res.json({
      success: true,
      message: 'Notifikasi berhasil diambil!',
      data: list
    });
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/:id/read', verifyToken, async (req, res, next) => {
  try {
    await notificationService.markAsRead(parseInt(req.params.id), req.user.id);
    res.json({
      success: true,
      message: 'Notifikasi ditandai sebagai dibaca!'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
