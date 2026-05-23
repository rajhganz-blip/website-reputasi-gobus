const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validation.middleware');
const { registerSchema, loginSchema } = require('../validations/auth.validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', verifyToken, authController.logout);
router.post('/refresh', authController.refresh);

module.exports = router;
