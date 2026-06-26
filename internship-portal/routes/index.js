/**
 * Index Routes
 * Public-facing page routes and authentication endpoints
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const indexController = require('../controllers/indexController');
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin, requireFaculty, requireCompany, requireStudent, isGuest } = require('../middleware/auth');

// ─── Public Routes ───────────────────────────────────────────────────────────
router.get('/', indexController.getHomePage);
router.get('/health', indexController.healthCheck);

// ─── Guest-Only Authentication Routes ────────────────────────────────────────
router.get('/login', isGuest, authController.getLoginPage);
router.post('/login', isGuest, authController.login);

// ─── Authenticated General Routes ────────────────────────────────────────────
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

router.get('/change-password', requireAuth, authController.getChangePasswordPage);
router.post('/change-password', requireAuth, authController.changePassword);

// ─── Role-Specific Dashboard Placeholders ────────────────────────────────────
router.get('/admin/dashboard', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-dashboard.html'));
});

router.get('/faculty/dashboard', requireAuth, requireFaculty, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/faculty-dashboard.html'));
});

router.get('/student/dashboard', requireAuth, requireStudent, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/student-dashboard.html'));
});

router.get('/company/dashboard', requireAuth, requireCompany, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/company-dashboard.html'));
});

// ─── Authentication API Endpoints ───────────────────────────────────────────
router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name || req.session.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;
