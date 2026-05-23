const EventEmitter = require('events');
const { getPool } = require('../config/db');

class NotificationService extends EventEmitter {
  async createNotification(userId, type, message) {
    try {
      const pool = getPool();
      
      const [result] = await pool.query(`
        INSERT INTO notifications (user_id, type, message, read_status)
        VALUES (?, ?, ?, 0)
      `, [userId, type, message]);

      const notification = {
        id: result.insertId,
        userId,
        type,
        message,
        readStatus: 0,
        createdAt: new Date()
      };

      // Emit event for socket server to capture and broadcast in real-time
      this.emit('notification:created', notification);

      // Email Dispatch simulation in server logs
      this.simulateEmailDispatch(userId, type, message);

      return notification;
    } catch (err) {
      console.error('Failed to create notification:', err.message);
    }
  }

  async getUserNotifications(userId) {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [userId]);
    return rows;
  }

  async markAsRead(notificationId, userId) {
    const pool = getPool();
    await pool.query(`
      UPDATE notifications 
      SET read_status = 1 
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);
    return true;
  }

  async simulateEmailDispatch(userId, type, message) {
    try {
      const pool = getPool();
      const [users] = await pool.query('SELECT email, name FROM users WHERE id = ?', [userId]);
      if (users.length === 0) return;

      const user = users[0];
      console.log(`\n✉️  [SIMULATED EMAIL DISPATCH] -------------------------`);
      console.log(`To: ${user.name} <${user.email}>`);
      console.log(`Subject: [GoBus] ${type.toUpperCase().replace('_', ' ')}`);
      console.log(`Content:\nHi ${user.name},\n${message}\n`);
      console.log(`------------------------------------------------------\n`);
    } catch (err) {
      console.error('Failed to simulate email dispatch:', err.message);
    }
  }
}

module.exports = new NotificationService();
