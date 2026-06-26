/**
 * Dashboard Routes
 * Protected routes for the main dashboard
 */

'use strict';

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

// All dashboard routes require authentication and user verification
router.use(requireAuth);

// Dashboard home (redirects based on role)
router.get('/', dashboardController.getDashboard);

module.exports = router;
