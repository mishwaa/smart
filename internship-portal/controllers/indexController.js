/**
 * Index Controller
 * Handles public-facing page requests
 */

'use strict';

const path = require('path');
const { testConnection } = require('../config/database');

const indexController = {
  /**
   * Render the home/landing page
   */
  getHomePage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
  },

  /**
   * Health check endpoint
   * Reports server and database status
   */
  async healthCheck(req, res) {
    const dbConnected = await testConnection();

    res.json({
      success: true,
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime()
    });
  }
};

module.exports = indexController;
