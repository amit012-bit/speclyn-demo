'use strict';

const { Server } = require('socket.io');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Engine message types we forward to the client as same-named events.
const FORWARDED_EVENTS = new Set(['gaps', 'final', 'error', 'transcript', 'status']);

/**
 * Attach a Socket.io server to the given HTTP server and relay
 * encounter messages between browser clients and the Python engine's
 * WebSocket /stream endpoint.
 *
 * Client -> relay:
 *   "transcript" { text }  -> engine {"type":"transcript","text":...}
 *   "end"                  -> engine {"type":"end"}, then close engine socket
 *
 * Engine -> relay -> client:
 *   {"type":"gaps",...}  -> "gaps" event
 *   {"type":"final",...} -> "final" event
 *   {"type":"error",...} -> "error" event
 */
function initRelay(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate every socket connection with the JWT passed in
  // socket.handshake.auth.token.
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    const engineWsUrl =
      (process.env.ENGINE_URL || 'http://localhost:8000').replace('http', 'ws') + '/stream';

    let engineWs = null; // lazily opened on first message
    let pendingMessages = []; // queued while the engine socket is connecting
    let ending = false; // client sent "end" — engine close is expected
    let clientGone = false; // socket.io client disconnected

    function connectEngine() {
      if (engineWs && (engineWs.readyState === WebSocket.OPEN || engineWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      logger.info(`Opening engine stream for ${socket.id} -> ${engineWsUrl}`);
      engineWs = new WebSocket(engineWsUrl);

      engineWs.on('open', () => {
        logger.info(`Engine stream open for ${socket.id}`);
        const queued = pendingMessages;
        pendingMessages = [];
        for (const msg of queued) {
          engineWs.send(msg);
        }
      });

      engineWs.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch (err) {
          logger.warn(`Unparseable engine message for ${socket.id}`);
          return;
        }
        const type = typeof msg.type === 'string' ? msg.type : 'message';
        if (type === 'error') {
          socket.emit('error', { error: msg.error || msg.message || 'Engine error' });
        } else if (FORWARDED_EVENTS.has(type)) {
          socket.emit(type, msg);
        } else {
          socket.emit('message', msg);
        }
        // Once the engine delivers its final analysis after "end",
        // the encounter is complete — close the engine socket.
        if (type === 'final' && ending && engineWs) {
          engineWs.close();
        }
      });

      engineWs.on('error', (err) => {
        logger.error(`Engine stream error for ${socket.id}: ${err.message}`);
        if (!clientGone) {
          socket.emit('error', { error: 'Could not reach the analysis engine' });
        }
      });

      engineWs.on('close', () => {
        logger.info(`Engine stream closed for ${socket.id}`);
        engineWs = null;
        pendingMessages = [];
        if (!clientGone && !ending) {
          // Unexpected engine disconnect mid-encounter — tell the client,
          // but keep the client socket alive; the next transcript message
          // will transparently reconnect.
          socket.emit('error', { error: 'Analysis engine disconnected' });
        }
        ending = false;
      });
    }

    function sendToEngine(obj) {
      const payload = JSON.stringify(obj);
      if (engineWs && engineWs.readyState === WebSocket.OPEN) {
        engineWs.send(payload);
      } else {
        pendingMessages.push(payload);
        connectEngine();
      }
    }

    socket.on('transcript', (data) => {
      const text = data && typeof data.text === 'string' ? data.text : null;
      if (text === null) {
        socket.emit('error', { error: 'transcript event requires { text }' });
        return;
      }
      sendToEngine({ type: 'transcript', text });
    });

    socket.on('end', () => {
      logger.info(`Client ${socket.id} ended encounter`);
      ending = true;
      if (engineWs && engineWs.readyState === WebSocket.OPEN) {
        try {
          engineWs.send(JSON.stringify({ type: 'end' }));
        } catch (err) {
          logger.warn(`Failed to send end to engine for ${socket.id}: ${err.message}`);
        }
        // Wait for the engine's "final" message (which closes the socket
        // in the message handler above); safety-close after 60s in case
        // the engine never responds.
        const ws = engineWs;
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            logger.warn(`Engine did not send final within 60s for ${socket.id}, closing`);
            ws.close();
          }
        }, 60_000);
      } else {
        pendingMessages = [];
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
      clientGone = true;
      pendingMessages = [];
      if (engineWs && (engineWs.readyState === WebSocket.OPEN || engineWs.readyState === WebSocket.CONNECTING)) {
        engineWs.close();
      }
      engineWs = null;
    });
  });

  return io;
}

module.exports = { initRelay };
