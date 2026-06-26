'use strict';

/**
 * @module middleware/auth
 * @description Authentication and authorization middleware for the internship portal.
 * Uses express-session to manage user sessions.
 */

/**
 * Middleware that checks if a user is authenticated via express-session.
 * If the request accepts JSON, responds with a 401 JSON error.
 * Otherwise, redirects the user to the login page.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }

  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }

  return res.redirect('/login');
};

/**
 * Higher-order middleware factory that restricts access to users with specific roles.
 * Must be used after {@link isAuthenticated} in the middleware chain.
 *
 * @param {...string} roles - One or more role strings that are permitted access
 * @returns {import('express').RequestHandler} Express middleware function
 *
 * @example
 * // Allow only admins
 * router.get('/admin', isAuthenticated, authorizeRoles('admin'), adminController);
 *
 * @example
 * // Allow admins and employers
 * router.get('/manage', isAuthenticated, authorizeRoles('admin', 'employer'), manageController);
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to perform this action.'
      });
    }

    return next();
  };
};

/**
 * Middleware that redirects already-authenticated users away from guest-only pages
 * (e.g., login, registration). If the user is already logged in, they are sent
 * to the dashboard. Otherwise, processing continues to the next middleware.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
const isGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }

  return next();
};

module.exports = {
  isAuthenticated,
  authorizeRoles,
  isGuest
};
