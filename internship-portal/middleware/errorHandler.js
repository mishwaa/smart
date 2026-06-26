'use strict';

/**
 * @module middleware/errorHandler
 * @description Centralized error handling middleware for the internship portal.
 * Provides a 404 catch-all handler and a global error handler that formats
 * errors consistently and handles multer-specific upload errors.
 */

const multer = require('multer');

/**
 * Middleware that catches requests to undefined routes and forwards a
 * 404 error to the global error handler.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

/**
 * Global error handling middleware. Logs the full error stack in development,
 * detects multer file-upload errors, and responds with a structured JSON payload.
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function (unused but required by Express)
 * @returns {void}
 */
const globalErrorHandler = (err, req, res, next) => {
  // Log the full stack trace in development for easier debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', err.stack);
  }

  // Handle multer-specific file upload errors
  if (err instanceof multer.MulterError) {
    /** @type {Record<string, string>} */
    const multerMessages = {
      LIMIT_FILE_SIZE: 'File size exceeds the allowed limit.',
      LIMIT_FILE_COUNT: 'Too many files uploaded.',
      LIMIT_FIELD_KEY: 'Field name is too long.',
      LIMIT_FIELD_VALUE: 'Field value is too long.',
      LIMIT_FIELD_COUNT: 'Too many fields submitted.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field encountered.'
    };

    const message = multerMessages[err.code] || err.message;

    return res.status(400).json({
      success: false,
      message,
      status: 400
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(status).json({
    success: false,
    message,
    status
  });
};

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
