/**
 * Smart University Internship & Placement Management Portal
 * Main Application Entry Point
 *
 * @description Express.js server configuration with session management,
 *              static file serving, routing, and error handling.
 */

'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const sessionConfig = require('./config/session');
const { testConnection } = require('./config/database');
const { isCodespaces } = require('./config/helpers');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');
const { sanitizeInput } = require('./middleware/validators');

// Import routes
const indexRoutes = require('./routes/index');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');

// ─── Initialize Express App ─────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ─── Core Middleware ─────────────────────────────────────────────────────────

// Parse request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session management
app.use(session(sessionConfig));

// Input sanitization (trims strings in req.body)
app.use(sanitizeInput);

// Make session user available to all responses (for templates)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ─── Static Files ────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// Protect uploads — only authenticated users can access (Phase 2 will refine)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/', indexRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Server Startup ──────────────────────────────────────────────────────────

async function startServer() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Smart University Internship & Placement Portal        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Detect environment
  if (isCodespaces()) {
    console.log('🌐 Running in GitHub Codespaces');
  }
  console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Test database connection
  await testConnection();

  // Start listening
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('');

    if (isCodespaces()) {
      console.log('💡 In Codespaces, use the forwarded port URL to access the app.');
    }
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
