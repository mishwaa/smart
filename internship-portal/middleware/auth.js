'use strict';

/**
 * @module middleware/auth
 * @description Authentication and authorization middleware for the internship portal.
 * Uses express-session to manage user sessions.
 */

const User = require('../models/User');

/**
 * Legacy Phase 1 Middleware (kept for compatibility)
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

const isGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }

  return next();
};

/**
 * Phase 2 Standard Middleware
 */

/**
 * Verify session and database user status.
 * Redirects or returns 401 if unauthenticated, inactive, or missing.
 * Forces password change if must_change_password is true.
 */
const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }
    return res.redirect('/login');
  }

  try {
    const user = await User.findById(req.session.user.id);
    if (!user || !user.is_active) {
      // Clear session if user was deleted or deactivated
      req.session.destroy(() => {
        res.clearCookie('internship.sid');
        if (req.accepts('json') && !req.accepts('html')) {
          return res.status(401).json({
            success: false,
            message: 'User account is inactive or does not exist.'
          });
        }
        return res.redirect('/login');
      });
      return;
    }

    // Expose user info on request object
    req.user = user;

    // Force password change if required
    // Exclude /change-password and /logout to prevent infinite redirect loops
    if (user.must_change_password && req.path !== '/change-password' && req.path !== '/logout') {
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(403).json({
          success: false,
          message: 'Password change required.',
          must_change_password: true
        });
      }
      return res.redirect('/change-password');
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Helper to generate role-based authorization middleware
 */
const requireRole = (role) => {
  return (req, res, next) => {
    // requireAuth must run before this to populate req.user
    if (!req.user) {
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }
      return res.redirect('/login');
    }

    if (req.user.role !== role) {
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Forbidden.'
        });
      }

      res.status(403);
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>403 Forbidden - Smart University</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
          <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
        </head>
        <body class="bg-light d-flex align-items-center justify-content-center" style="height: 100vh; font-family: 'Segoe UI', system-ui, sans-serif;">
          <div class="text-center p-5 bg-white rounded-4 shadow-sm" style="max-width: 500px;">
            <div class="text-danger mb-4">
              <i class="bi bi-shield-slash-fill" style="font-size: 64px;"></i>
            </div>
            <h1 class="h3 mb-3 fw-bold text-dark">403 - Access Denied</h1>
            <p class="text-muted mb-4">You do not have permission to view this page. This resource is restricted to authorized users.</p>
            <a href="/dashboard" class="btn btn-primary px-4 py-2 rounded-3">Go to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    return next();
  };
};

const requireAdmin = requireRole('admin');
const requireFaculty = requireRole('faculty');
const requireCompany = requireRole('company');
const requireStudent = requireRole('student');

module.exports = {
  isAuthenticated,
  authorizeRoles,
  isGuest,
  requireAuth,
  requireAdmin,
  requireFaculty,
  requireCompany,
  requireStudent
};
