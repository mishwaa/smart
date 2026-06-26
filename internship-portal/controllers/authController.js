/**
 * Auth Controller
 * Handles authentication, login, logout, and password change
 */

'use strict';

const path = require('path');
const User = require('../models/User');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const authController = {
  /**
   * Render the login page
   */
  getLoginPage(req, res) {
    // If already logged in, redirect to dashboard
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
  },

  /**
   * Handle login form submission
   */
  async login(req, res) {
    const { email, password, remember } = req.body;

    // 1. Input Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    try {
      // 2. Find User
      const user = await User.findByEmail(email);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      // 3. Verify Password
      const isMatch = await User.verifyPassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      // 4. Regenerate Session to prevent session fixation attacks
      req.session.regenerate(async (err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({
            success: false,
            message: 'An error occurred during login. Please try again.'
          });
        }

        // 5. Store Session Data
        req.session.user = {
          id: user.id,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          role: user.role
        };

        // Handle "Remember Session" checkbox
        if (remember === 'true' || remember === true) {
          // Keep session for 30 days
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        } else {
          // Keep default (24 hours as defined in session config)
          req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
        }

        // Determine Redirect Destination
        let redirectUrl = '/dashboard';
        if (user.must_change_password) {
          redirectUrl = '/change-password';
        } else {
          switch (user.role) {
            case 'admin':
              redirectUrl = '/admin/dashboard';
              break;
            case 'faculty':
              redirectUrl = '/faculty/dashboard';
              break;
            case 'student':
              redirectUrl = '/student/dashboard';
              break;
            case 'company':
              redirectUrl = '/company/dashboard';
              break;
          }
        }

        return res.json({
          success: true,
          message: 'Login successful.',
          redirectUrl,
          user: {
            id: user.id,
            name: req.session.user.name,
            email: user.email,
            role: user.role,
            must_change_password: user.must_change_password
          }
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during login.'
      });
    }
  },

  /**
   * Render the change password page
   */
  getChangePasswordPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'change-password.html'));
  },

  /**
   * Handle change password form submission
   */
  async changePassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id;

    // 1. Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match.'
      });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.'
      });
    }

    try {
      // 2. Fetch User with Password
      const user = await User.findByEmail(req.session.user.email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      // 3. Verify Current Password
      const isMatch = await User.verifyPassword(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }

      // 4. Update Password & Reset flag
      await User.update(userId, {
        password: newPassword,
        must_change_password: false
      });

      // Update session info if required (the flag changed in the DB)
      return res.json({
        success: true,
        message: 'Password changed successfully.',
        redirectUrl: `/dashboard` // Will auto-redirect to their specific role dashboard now
      });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during password change.'
      });
    }
  },

  /**
   * Handle logout request
   */
  logout(req, res) {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session during logout:', err);
        }
        res.clearCookie('internship.sid');
        
        if (req.accepts('json') && !req.accepts('html')) {
          return res.json({
            success: true,
            message: 'Logged out successfully.',
            redirectUrl: '/login'
          });
        }
        return res.redirect('/login');
      });
    } else {
      res.clearCookie('internship.sid');
      return res.redirect('/login');
    }
  }
};

module.exports = authController;
