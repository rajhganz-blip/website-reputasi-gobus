const { CustomError } = require('../utils/customError');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = 'Terjadi kesalahan internal server';
  let errors = null;

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Data yang dimasukkan sudah ada di database';
  } else {
    // Log unexpected errors
    logger.error(`Unexpected Error: ${err.message}`);
    if (process.env.NODE_ENV !== 'production') {
      logger.error(err.stack);
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== 'production' && { debug: err.stack })
  });
}

module.exports = errorHandler;
