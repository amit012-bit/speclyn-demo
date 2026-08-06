'use strict';

const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

function engineUrl() {
  return process.env.ENGINE_URL || 'http://localhost:8000';
}

/**
 * POST /analysis/analyze  (JWT-protected)
 * Forwards the request body to the Python engine's POST /analyze
 * and returns the engine's JSON response verbatim.
 * Engine failures are mapped to clean JSON errors — never stack traces.
 */
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const response = await axios.post(`${engineUrl()}/analyze`, req.body, {
      timeout: 60_000,
      headers: { 'Content-Type': 'application/json' },
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    // Engine responded with an error status
    if (err.response) {
      logger.warn(`Engine returned ${err.response.status} for /analyze`);
      const data = err.response.data;
      const message =
        (data && typeof data === 'object' && (data.error || data.detail)) ||
        'Analysis engine returned an error';
      return res
        .status(err.response.status)
        .json({ error: typeof message === 'string' ? message : 'Analysis engine returned an error' });
    }

    // Timeout
    if (err.code === 'ECONNABORTED') {
      logger.error('Engine request timed out');
      return res.status(504).json({ error: 'Analysis engine timed out' });
    }

    // Connection refused / DNS failure / engine down
    logger.error(`Engine unreachable: ${err.code || err.message}`);
    return res.status(503).json({ error: 'Analysis engine is unavailable' });
  }
});

/**
 * GET /analysis/stt-token  (JWT-protected)
 * Proxies the engine's GET /stt/token — mints a single-use AssemblyAI
 * realtime token plus the medical STT config for the browser client.
 * The AssemblyAI API key never leaves the engine.
 */
router.get('/stt-token', requireAuth, async (req, res) => {
  try {
    const response = await axios.get(`${engineUrl()}/stt/token`, {
      timeout: 20_000,
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      logger.warn(`Engine returned ${err.response.status} for /stt/token`);
      const data = err.response.data;
      const message =
        (data && typeof data === 'object' && (data.error || data.detail)) ||
        'Voice transcription is unavailable';
      return res
        .status(err.response.status)
        .json({ error: typeof message === 'string' ? message : 'Voice transcription is unavailable' });
    }
    if (err.code === 'ECONNABORTED') {
      logger.error('Engine /stt/token timed out');
      return res.status(504).json({ error: 'Voice token request timed out' });
    }
    logger.error(`Engine unreachable for /stt/token: ${err.code || err.message}`);
    return res.status(503).json({ error: 'Analysis engine is unavailable' });
  }
});

module.exports = router;
