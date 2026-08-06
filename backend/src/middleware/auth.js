'use strict';

const jwt = require('jsonwebtoken');

/**
 * JWT verification middleware.
 * Expects: Authorization: Bearer <token>
 * On success, attaches the decoded payload to req.user.
 * On failure, responds 401 with { error: "..." }.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
