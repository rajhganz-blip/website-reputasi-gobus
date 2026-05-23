const scheduleService = require('../services/schedule.service');

class ScheduleController {
  async searchSchedules(req, res, next) {
    try {
      const results = await scheduleService.searchSchedules(req.query);
      res.json({
        success: true,
        message: 'Jadwal berhasil ditemukan!',
        data: results
      });
    } catch (err) {
      next(err);
    }
  }

  async getScheduleById(req, res, next) {
    try {
      const schedule = await scheduleService.getScheduleById(parseInt(req.params.id));
      res.json({
        success: true,
        message: 'Jadwal berhasil diambil!',
        data: schedule
      });
    } catch (err) {
      next(err);
    }
  }

  async createSchedule(req, res, next) {
    try {
      const schedule = await scheduleService.createSchedule(req.body);
      res.status(201).json({
        success: true,
        message: 'Jadwal baru berhasil ditambahkan!',
        data: schedule
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSchedule(req, res, next) {
    try {
      const schedule = await scheduleService.updateSchedule(parseInt(req.params.id), req.body);
      res.json({
        success: true,
        message: 'Jadwal berhasil diperbarui!',
        data: schedule
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteSchedule(req, res, next) {
    try {
      await scheduleService.deleteSchedule(parseInt(req.params.id));
      res.json({
        success: true,
        message: 'Jadwal berhasil dibatalkan/dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ScheduleController();
