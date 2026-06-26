/**
 * Dashboard Routes
 * Protected routes for the main dashboard
 */

'use strict';

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(isAuthenticated);

// Dashboard home
router.get('/', dashboardController.getDashboard);

module.exports = router;
