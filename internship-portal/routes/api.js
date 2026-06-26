/**
 * API Routes
 * RESTful API endpoints (placeholder for Phase 2+)
 */

'use strict';

const express = require('express');
const router = express.Router();

// API health check
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
