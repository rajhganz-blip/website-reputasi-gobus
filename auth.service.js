const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const { accessSecret, refreshSecret, accessExpiry, refreshExpiry } = require('../config/jwt');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../utils/customError');

class AuthService {
  async register({ username, password, name, email, phone, role = 'customer' }) {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Check username exists
      const [userExists] = await conn.query('SELECT id FROM users WHERE username = ? FOR UPDATE', [username]);
      if (userExists.length > 0) {
        throw new ConflictError('Username sudah terdaftar');
      }

      // Check email exists
      const [emailExists] = await conn.query('SELECT id FROM users WHERE email = ? FOR UPDATE', [email]);
      if (emailExists.length > 0) {
        throw new ConflictError('Email sudah terdaftar');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert user
      const [result] = await conn.query(
        'INSERT INTO users (username, password, name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, name, email, phone || null, role]
      );

      await conn.commit();
      return { id: result.insertId, username, name, email, role };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async login({ username, password }) {
    const pool = getPool();
    
    // Get user
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      throw new UnauthorizedError('Username atau password salah');
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Username atau password salah');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token to database
    await pool.query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
  }

  async refreshToken(token) {
    if (!token) {
      throw new UnauthorizedError('Refresh token tidak ditemukan');
    }

    const pool = getPool();

    // Verify token structure
    let decoded;
    try {
      decoded = jwt.verify(token, refreshSecret);
    } catch (err) {
      throw new UnauthorizedError('Refresh token tidak valid atau kadaluarsa');
    }

    // Check refresh token in database
    const [users] = await pool.query('SELECT * FROM users WHERE id = ? AND refresh_token = ?', [decoded.id, token]);
    if (users.length === 0) {
      throw new UnauthorizedError('Sesi tidak valid. Silakan login kembali.');
    }

    const user = users[0];

    // Generate new access token
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Update refresh token in DB (token rotation)
    await pool.query('UPDATE users SET refresh_token = ? WHERE id = ?', [newRefreshToken, user.id]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(userId) {
    const pool = getPool();
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [userId]);
    return true;
  }

  generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      accessSecret,
      { expiresIn: accessExpiry }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      refreshSecret,
      { expiresIn: refreshExpiry }
    );
  }
}

module.exports = new AuthService();
