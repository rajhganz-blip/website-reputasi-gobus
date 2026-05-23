class CustomError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends CustomError {
  constructor(message = 'Request tidak valid', errors = null) {
    super(message, 400, errors);
  }
}

class UnauthorizedError extends CustomError {
  constructor(message = 'Tidak terotorisasi') {
    super(message, 401);
  }
}

class ForbiddenError extends CustomError {
  constructor(message = 'Akses ditolak') {
    super(message, 403);
  }
}

class NotFoundError extends CustomError {
  constructor(message = 'Resource tidak ditemukan') {
    super(message, 404);
  }
}

class ConflictError extends CustomError {
  constructor(message = 'Resource sudah ada/bertabrakan') {
    super(message, 409);
  }
}

class InternalServerError extends CustomError {
  constructor(message = 'Terjadi kesalahan pada server') {
    super(message, 500);
  }
}

module.exports = {
  CustomError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError
};
