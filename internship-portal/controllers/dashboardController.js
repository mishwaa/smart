/**
 * Dashboard Controller
 * Handles dashboard page requests
 */

'use strict';

const path = require('path');

const dashboardController = {
  /**
   * Render the main dashboard
   */
  getDashboard(req, res) {
    // In Phase 2+, this will render role-specific dashboards
    // For now, serve the layout template
    res.sendFile(path.join(__dirname, '..', 'views', 'layout.html'));
  }
};

module.exports = dashboardController;
