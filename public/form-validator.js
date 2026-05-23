/**
 * Input Validation Utilities for Frontend
 * Add to index.html or include in script.js
 * 
 * Validates all user inputs before submission
 */

const FormValidator = {
  // Email validation
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && email.length <= 254;
  },

  // Phone validation (Indonesian format)
  isValidPhone(phone) {
    const re = /^(\+62|0)[0-9]{8,12}$/;
    return re.test(phone.replace(/\s+/g, ''));
  },

  // Password validation (min 8 chars, mix of letters and numbers)
  isValidPassword(password) {
    return password.length >= 8 && /[a-z]/i.test(password) && /[0-9]/.test(password);
  },

  // Username validation (alphanumeric, 4-20 chars)
  isValidUsername(username) {
    const re = /^[a-zA-Z0-9_]{4,20}$/;
    return re.test(username);
  },

  // Name validation (at least 2 words or 3+ characters)
  isValidName(name) {
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.split(' ').length >= 1;
  },

  // Date validation (must be future date for bookings)
  isValidDate(date) {
    const d = new Date(date);
    return d > new Date() && !isNaN(d);
  },

  // Validate booking form
  validateBookingForm(data) {
    const errors = [];

    if (!data.passengerName || data.passengerName.trim().length < 3) {
      errors.push('Nama penumpang minimal 3 karakter');
    }

    if (!this.isValidEmail(data.passengerEmail)) {
      errors.push('Email tidak valid');
    }

    if (!this.isValidPhone(data.passengerPhone)) {
      errors.push('Nomor telepon harus format Indonesia (08xx atau +62xx)');
    }

    if (!data.selectedSeats || data.selectedSeats.length === 0) {
      errors.push('Pilih minimal 1 kursi');
    }

    if (!data.scheduleId) {
      errors.push('Jadwal tidak valid');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate registration form
  validateRegisterForm(data) {
    const errors = [];

    if (!this.isValidName(data.name)) {
      errors.push('Nama minimal 3 karakter');
    }

    if (!this.isValidUsername(data.username)) {
      errors.push('Username harus 4-20 karakter (huruf, angka, underscore)');
    }

    if (!this.isValidEmail(data.email)) {
      errors.push('Email tidak valid');
    }

    if (!this.isValidPassword(data.password)) {
      errors.push('Password minimal 8 karakter (huruf dan angka)');
    }

    if (data.phone && !this.isValidPhone(data.phone)) {
      errors.push('Nomor telepon tidak valid');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate login form
  validateLoginForm(data) {
    const errors = [];

    if (!data.username || data.username.trim().length === 0) {
      errors.push('Username wajib diisi');
    }

    if (!data.password || data.password.length === 0) {
      errors.push('Password wajib diisi');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Sanitize input (prevent XSS)
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    const element = document.createElement('div');
    element.textContent = input;
    return element.innerHTML;
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormValidator;
}
