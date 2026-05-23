const { getPool } = require('../config/db');

class AnalyticsService {
  async getDashboardAnalytics() {
    const pool = getPool();

    // 1. Total Revenue (all paid bookings)
    const [[revenueRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_price), 0) as totalRevenue 
      FROM bookings 
      WHERE payment_status = 'paid'
    `);

    // 2. Total Tickets Sold (sum of total_seats for paid bookings)
    const [[ticketsRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_seats), 0) as ticketsSold 
      FROM bookings 
      WHERE payment_status = 'paid'
    `);

    // 3. Active schedules count
    const [[schedulesRow]] = await pool.query(`
      SELECT COUNT(*) as activeSchedules 
      FROM schedules 
      WHERE status = 'active'
    `);

    // 4. Popular Routes (Top 5 based on paid ticket counts)
    const [popularRoutes] = await pool.query(`
      SELECT r.origin, r.destination, 
             COUNT(b.id) as bookingCount, 
             SUM(b.total_seats) as totalSeatsSold,
             SUM(b.total_price) as totalRevenue
      FROM bookings b
      JOIN schedules s ON b.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      WHERE b.payment_status = 'paid'
      GROUP BY r.id
      ORDER BY totalSeatsSold DESC
      LIMIT 5
    `);

    // 5. Monthly Booking Trend (Last 6 Months)
    const [monthlyTrend] = await pool.query(`
      SELECT DATE_FORMAT(booking_date, '%Y-%m') as month,
             COUNT(*) as bookingCount,
             SUM(total_price) as monthlyRevenue
      FROM bookings
      WHERE payment_status = 'paid'
      GROUP BY month
      ORDER BY month ASC
      LIMIT 6
    `);

    // 6. Bus Class Distribution
    const [busClassDistribution] = await pool.query(`
      SELECT bus.bus_class as busClass, 
             COUNT(b.id) as ticketCount,
             SUM(b.total_price) as classRevenue
      FROM bookings b
      JOIN schedules s ON b.schedule_id = s.id
      JOIN buses bus ON s.bus_id = bus.id
      WHERE b.payment_status = 'paid'
      GROUP BY bus.bus_class
    `);

    return {
      overview: {
        totalRevenue: parseFloat(revenueRow.totalRevenue),
        ticketsSold: parseInt(ticketsRow.ticketsSold),
        activeSchedules: parseInt(schedulesRow.activeSchedules)
      },
      popularRoutes,
      monthlyTrend: monthlyTrend.map(t => ({
        month: t.month,
        bookingCount: parseInt(t.bookingCount),
        monthlyRevenue: parseFloat(t.monthlyRevenue)
      })),
      busClassDistribution: busClassDistribution.map(c => ({
        busClass: c.busClass,
        ticketCount: parseInt(c.ticketCount),
        classRevenue: parseFloat(c.classRevenue)
      }))
    };
  }
}

module.exports = new AnalyticsService();
