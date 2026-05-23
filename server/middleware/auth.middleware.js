const jwt = require('jsonwebtoken');
const { accessSecret } = require('../config/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/customError');

const verifyToken = (req, res, next) => {
  let token = null;

  // 1. Get token from Authorization header (Bearer)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  // 2. Fallback to custom header for admin UI
  if (!token && req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  }
  // 3. Fallback to HttpOnly cookie
  if (!token && req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token otentikasi tidak ditemukan. Silakan login kembali.' });
  }

  jwt.verify(token, accessSecret, (err, decoded) => {
    if (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Sesi Anda telah berakhir. Silakan login ulang.'
        : 'Token tidak valid atau telah dimodifikasi.';
      return res.status(401).json({ success: false, message: msg });
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };

    next();
  });
};

const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses dibatasi. Hanya untuk administrator.' });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin
};
