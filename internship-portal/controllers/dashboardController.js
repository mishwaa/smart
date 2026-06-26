/**
 * Dashboard Controller
 * Handles dashboard page requests
 */

'use strict';

const dashboardController = {
  /**
   * Render the main dashboard (redirects to the role-specific dashboard)
   */
  getDashboard(req, res) {
    if (req.session && req.session.user) {
      const role = req.session.user.role;
      return res.redirect(`/${role}/dashboard`);
    }
    return res.redirect('/login');
  }
};

module.exports = dashboardController;
