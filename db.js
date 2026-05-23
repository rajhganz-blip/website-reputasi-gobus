const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'gobus',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0
};

let pool;

async function connectDB() {
  if (pool) return pool;

  try {
    // Step 1: Connect to MySQL (no DB selected) and ensure DB exists
    const initConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await initConn.end();

    // Step 2: Create the main pool
    pool = mysql.createPool(dbConfig);
    console.log('✅ MySQL Pool Created Successfully');

    // Step 3: Check if schema needs to be imported
    const conn = await pool.getConnection();
    const [tables] = await conn.query('SHOW TABLES LIKE "users"');
    conn.release();

    if (tables.length === 0) {
      console.log('⚠️  Database tables missing.');
      // Only auto-import schema in non-production when explicitly allowed
      const importAllowed = process.env.IMPORT_SCHEMA === 'true' && process.env.NODE_ENV !== 'production';
      const sqlPath = path.join(__dirname, '../../database.sql');
      if (importAllowed && fs.existsSync(sqlPath)) {
        console.log('⚠️  Importing schema because IMPORT_SCHEMA=true and not in production');
        // Use a separate connection with multipleStatements enabled
        const multiConn = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          password: dbConfig.password,
          database: dbConfig.database,
          multipleStatements: true
        });
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await multiConn.query(sql);
        await multiConn.end();
        console.log('✅ Database schema imported successfully!');
      } else {
        console.warn('⚠️  Database schema not imported automatically. Please run migrations or set IMPORT_SCHEMA=true in a non-production environment.');
        if (!fs.existsSync(sqlPath)) console.warn('⚠️  database.sql schema file not found at:', sqlPath);
      }
    } else {
      console.log('📊 MySQL Database Tables Verified');
    }

    return pool;
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err);
    throw err;
  }
}

module.exports = {
  connectDB,
  getPool: () => {
    if (!pool) {
      throw new Error('Database pool not initialized. Call connectDB() first.');
    }
    return pool;
  }
};
