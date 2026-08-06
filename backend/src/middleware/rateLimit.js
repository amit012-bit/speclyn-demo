'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter: 60 requests per minute per IP.
 * All limit responses use the standard clean JSON error shape.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please slow down' });
  },
});

/**
 * Stricter limiter for the login endpoint: 10 attempts per minute per IP.
 * Slows down password brute-forcing.
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many login attempts, try again in a minute' });
  },
});

module.exports = globalLimiter;
module.exports.loginLimiter = loginLimiter;
