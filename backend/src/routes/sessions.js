'use strict';

const express = require('express');
const crypto = require('crypto');
const requireAuth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Simple in-memory session store (pilot stage — no database).
// Sessions are lost on restart, which is acceptable for encounters.
const sessions = new Map();

router.use(requireAuth);

/**
 * POST /sessions
 * Creates a new encounter session.
 * 201 -> { id, status, startedAt }
 */
router.post('/', (req, res) => {
  const id = crypto.randomUUID();
  const session = {
    id,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  sessions.set(id, session);
  logger.info(`Session created: ${id}`);
  return res.status(201).json(session);
});

/**
 * POST /sessions/:id/end
 * Ends an active encounter session.
 * 200 -> { id, status, startedAt, endedAt }
 * 404 -> { error } if the session does not exist
 */
router.post('/:id/end', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.status !== 'ended') {
    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    logger.info(`Session ended: ${session.id}`);
  }
  return res.json(session);
});

module.exports = router;
