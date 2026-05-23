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
  multipleStatements: true // Crucial for executing entire sql file in one go!
};

async function rebuildDB() {
  try {
    const conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });

    console.log('Dropping database if exists...');
    await conn.query(`DROP DATABASE IF EXISTS \`${dbConfig.database}\``);
    console.log('Creating database...');
    await conn.query(`CREATE DATABASE \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbConfig.database}\``);

    const sqlPath = path.join(__dirname, '../database.sql');
    console.log('Reading database.sql from:', sqlPath);
    if (!fs.existsSync(sqlPath)) {
      throw new Error('database.sql not found!');
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing entire database.sql schema...');
    await conn.query(sql);

    console.log('✅ Database rebuilt and populated successfully with multipleStatements!');
    await conn.end();
  } catch (err) {
    console.error('❌ Failed to rebuild database:', err);
  }
}

rebuildDB();
