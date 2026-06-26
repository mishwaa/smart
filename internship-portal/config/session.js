/**
 * Session Configuration
 * express-session setup with secure defaults
 */

'use strict';

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'default_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'internship.sid'
};

module.exports = sessionConfig;
