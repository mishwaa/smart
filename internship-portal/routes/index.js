/**
 * Index Routes
 * Public-facing page routes
 */

'use strict';

const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');

// Home page
router.get('/', indexController.getHomePage);

// Health check endpoint (useful for monitoring)
router.get('/health', indexController.healthCheck);

module.exports = router;
