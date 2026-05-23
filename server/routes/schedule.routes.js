const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const validate = require('../middleware/validation.middleware');
const { searchScheduleSchema } = require('../validations/schedule.validation');
const { getPool } = require('../config/db');

// Public: list all active routes with minimum price
router.get('/routes', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT r.id, r.origin, r.destination, r.distance_km, r.description,
             MIN(s.base_price) as min_price
      FROM routes r
      LEFT JOIN schedules s ON s.route_id = r.id AND s.status = 'active'
      WHERE r.is_active = 1
      GROUP BY r.id, r.origin, r.destination, r.distance_km, r.description
      ORDER BY r.origin ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(searchScheduleSchema, 'query'), scheduleController.searchSchedules);
router.get('/:id', scheduleController.getScheduleById);

module.exports = router;
