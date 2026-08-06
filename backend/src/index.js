'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');

const logger = require('./utils/logger');
const globalLimiter = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const analysisRoutes = require('./routes/analysis');
const { initRelay } = require('./websocket/relay');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);

// Health check (unauthenticated)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/sessions', sessionRoutes);
app.use('/analysis', analysisRoutes);

// 404 — clean JSON shape
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler — never leak stack traces
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  logger.error(`Unhandled error: ${err.message}`);
  return res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
initRelay(server);

const PORT = parseInt(process.env.PORT, 10) || 4000;

server.listen(PORT, () => {
  logger.info(`Speclyn backend listening on port ${PORT}`);
  logger.info(`Engine URL: ${process.env.ENGINE_URL || 'http://localhost:8000'}`);
  logger.info(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
  if (!process.env.JWT_SECRET) {
    logger.warn('JWT_SECRET is not set — logins and token verification will fail');
  }
});
