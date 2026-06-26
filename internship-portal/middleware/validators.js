'use strict';

/**
 * @module middleware/validators
 * @description Input sanitization and validation middleware for the internship portal.
 * Provides reusable utilities for trimming input, validating emails, and
 * enforcing required fields on incoming request bodies.
 */

/**
 * Recursively trims all string values in an object or array.
 *
 * @param {*} value - The value to sanitize
 * @returns {*} The sanitized value with all strings trimmed
 * @private
 */
const trimDeep = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(trimDeep);
  }

  if (value !== null && typeof value === 'object') {
    /** @type {Record<string, *>} */
    const trimmed = {};
    for (const key of Object.keys(value)) {
      trimmed[key] = trimDeep(value[key]);
    }
    return trimmed;
  }

  return value;
};

/**
 * Middleware that recursively trims all string values in req.body.
 * Non-string values are left untouched.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = trimDeep(req.body);
  }
  next();
};

/**
 * Validates an email address against a reasonable regular expression pattern.
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} True if the email format is valid, false otherwise
 *
 * @example
 * validateEmail('user@example.com');  // true
 * validateEmail('invalid-email');     // false
 */
const validateEmail = (email) => {
  if (typeof email !== 'string') {
    return false;
  }

  // Reasonable email regex: local@domain.tld
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * Higher-order middleware factory that validates the presence of required fields
 * in req.body. Each field must exist and be a non-empty string after trimming.
 *
 * @param {string[]} fields - Array of field names that must be present and non-empty
 * @returns {import('express').RequestHandler} Express middleware function
 *
 * @example
 * router.post('/register', validateRequired(['name', 'email', 'password']), registerController);
 */
const validateRequired = (fields) => {
  return (req, res, next) => {
    /** @type {string[]} */
    const missing = [];

    for (const field of fields) {
      const value = req.body[field];

      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }

    return next();
  };
};

module.exports = {
  sanitizeInput,
  validateEmail,
  validateRequired
};
