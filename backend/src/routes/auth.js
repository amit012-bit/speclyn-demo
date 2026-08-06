'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { loginLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const router = express.Router();

// The PASSWORD env var holds the shared plaintext password (pilot-stage,
// no user accounts). We hash it once at startup so every comparison goes
// through bcrypt (constant-time, no plaintext string comparison).
// If PASSWORD is already a bcrypt hash ($2a$/$2b$/$2y$...), use it as-is.
let passwordHash = null;

function getPasswordHash() {
  if (!passwordHash) {
    const configured = process.env.PASSWORD || '';
    if (/^\$2[aby]\$/.test(configured)) {
      passwordHash = configured;
    } else {
      passwordHash = bcrypt.hashSync(configured, 10);
    }
  }
  return passwordHash;
}

/**
 * POST /auth/login
 * Body: { password: string }
 * 200 -> { token }  (JWT, 24h expiry)
 * 401 -> { error }
 */
router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (!process.env.PASSWORD) {
    logger.error('PASSWORD env var is not set — refusing all logins');
    return res.status(500).json({ error: 'Server is not configured for login' });
  }

  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET env var is not set — cannot issue tokens');
    return res.status(500).json({ error: 'Server is not configured for login' });
  }

  const match = bcrypt.compareSync(password, getPasswordHash());
  if (!match) {
    logger.warn('Failed login attempt');
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'user' }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });

  logger.info('Successful login, token issued');
  return res.json({ token });
});

module.exports = router;
