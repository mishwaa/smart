/**
 * Helper Utilities
 * Reusable utility functions used across the application
 */

'use strict';

/**
 * Generate a unique certificate number
 * Format: CERT-YYYY-XXXXX (e.g., CERT-2024-00042)
 * @param {number} id - The certificate record ID
 * @returns {string}
 */
function generateCertificateNumber(id) {
  const year = new Date().getFullYear();
  const paddedId = String(id).padStart(5, '0');
  return `CERT-${year}-${paddedId}`;
}

/**
 * Format a date to a human-readable string
 * @param {Date|string} date
 * @param {string} locale
 * @returns {string}
 */
function formatDate(date, locale = 'en-IN') {
  const d = new Date(date);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Paginate query results
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} - { offset, limit }
 */
function paginate(page = 1, limit = 20) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return {
    offset: (safePage - 1) * safeLimit,
    limit: safeLimit,
    page: safePage
  };
}

/**
 * Create a standardized API response object
 * @param {boolean} success
 * @param {string} message
 * @param {Object} data
 * @returns {Object}
 */
function apiResponse(success, message, data = null) {
  const response = { success, message };
  if (data !== null) {
    response.data = data;
  }
  return response;
}

/**
 * Check if currently running in GitHub Codespaces
 * @returns {boolean}
 */
function isCodespaces() {
  return !!(process.env.CODESPACES || process.env.CODESPACE_NAME);
}

module.exports = {
  generateCertificateNumber,
  formatDate,
  paginate,
  apiResponse,
  isCodespaces
};
