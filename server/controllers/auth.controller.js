const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');
const { accessSecret, accessExpiry } = require('../config/jwt');
const { UnauthorizedError } = require('../utils/customError');

class AuthController {
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Registrasi pengguna berhasil! Silakan masuk.',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { accessToken, refreshToken, user } = await authService.login(req.body);

      // Set JWT tokens in HttpOnly cookies for elevated security
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 mins for accessToken when used
      };

      res.cookie('accessToken', accessToken, cookieOpts);
      res.cookie('refreshToken', refreshToken, {
        ...cookieOpts,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for refresh
      });

      const responseData = { success: true, message: 'Login berhasil!', data: { user } };
      // In non-production include tokens in body for easier integration/testing
      if (process.env.NODE_ENV !== 'production') {
        responseData.data.accessToken = accessToken;
        responseData.data.refreshToken = refreshToken;
      }

      res.json(responseData);
    } catch (err) {
      next(err);
    }
  }

  // Admin login (hardcoded credentials - production: use DB)
  async adminLogin(req, res, next) {
    try {
      const { username, password } = req.body;
      
      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username dan password harus diisi'
        });
      }
      
      // Hardcoded admin credentials (CHANGE IN PRODUCTION)
      const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
      
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign(
          { id: 0, username: 'admin', email: '', role: 'admin' },
          accessSecret,
          { expiresIn: accessExpiry }
        );
        
        // Set as HttpOnly cookie too for frontend compatibility
        res.cookie('adminToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000
        });
        
        return res.json({
          success: true,
          message: 'Login admin berhasil!',
          token,
          admin: { name: 'Administrator', username: 'admin' }
        });
      }
      
      throw new UnauthorizedError('Username atau password salah');
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      // Try to get refresh token from cookie, then body
      const token = req.cookies.refreshToken || req.body.refreshToken;
      
      const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(token);

      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      };

      res.cookie('accessToken', accessToken, cookieOpts);
      res.cookie('refreshToken', newRefreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });

      const responseData = { success: true, message: 'Token berhasil di-refresh!', data: {} };
      if (process.env.NODE_ENV !== 'production') {
        responseData.data.accessToken = accessToken;
        responseData.data.refreshToken = newRefreshToken;
      }

      res.json(responseData);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      if (req.user) {
        await authService.logout(req.user.id);
      }

      // Clear cookies
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };
      res.clearCookie('accessToken', cookieOpts);
      res.clearCookie('refreshToken', cookieOpts);

      res.json({
        success: true,
        message: 'Logout berhasil! Sesi telah berakhir.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
