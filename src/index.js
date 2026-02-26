// Cargar .env.local primero si existe (desarrollo local), luego .env
(async () => {
  try {
    console.log('[provider-service] Starting...');
    const fs = require('fs');
    if (fs.existsSync('.env.local')) {
      require('dotenv').config({ path: '.env.local' });
      console.log('[provider-service] Loaded .env.local');
    }
    require('dotenv').config(); // .env tiene menor prioridad
    console.log('[provider-service] Environment variables loaded');

    const express = require('express');
    const cors = require('cors');
    const helmet = require('helmet');
    const morgan = require('morgan');
    const { v4: uuidv4 } = require('uuid');

    let sequelize;
    try {
      console.log('[provider-service] Loading models...');
      const models = require('../models');
      sequelize = models.sequelize;
      console.log('[provider-service] Models loaded successfully');

      // Auto-sync tables for SQLite development (when no DATABASE_URL)
      if (!process.env.DATABASE_URL) {
        console.log('[provider-service] SQLite mode - syncing tables...');
        await sequelize.sync({ alter: true });
        console.log('[provider-service] SQLite tables synced successfully');
      }
    } catch (error) {
      console.error('[provider-service] Error loading models:', error);
      console.error('[provider-service] Error stack:', error.stack);
      process.exit(1);
    }

    const app = express();
    const PORT = process.env.PORT || 4003;

    // confiar en proxy (Railway)
    app.set('trust proxy', 1);

    // CORS (whitelist en prod, libre en dev/postman)
    const origins = (process.env.CORS_ORIGINS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    app.use(cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (process.env.NODE_ENV !== 'production') return cb(null, true);
        return cb(null, origins.length === 0 || origins.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
    }));

    app.use(helmet());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // request-id para trazas
    app.use((req, res, next) => {
      req.id = req.headers['x-request-id'] || uuidv4();
      res.set('x-request-id', req.id);
      next();
    });

    app.use(morgan(':method :url :status - :response-time ms - :req[x-request-id]'));

    // timeouts prudentes
    app.use((req, res, next) => {
      req.setTimeout(30000);
      res.setTimeout(30000);
      next();
    });

    // Health / Readiness (dejé tus aliases)
    app.get('/health', (_req, res) => res.json({ ok: true, service: 'provider-service' }));
    app.get('/ready', async (_req, res) => {
      try { await sequelize.authenticate(); return res.json({ ok: true }); }
      catch { return res.status(503).json({ ok: false }); }
    });
    app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'provider-service' }));
    app.get('/readyz', async (_req, res) => {
      try { await sequelize.authenticate(); return res.json({ ok: true }); }
      catch { return res.status(503).json({ ok: false }); }
    });

    // Rutas
    try {
      console.log('[provider-service] Loading routes...');
      app.use('/api/v1/providers', require('./routes/provider.routes'));
      app.use('/api/v1/categories', require('./routes/category.routes'));
      app.use('/api/v1/chat', require('./routes/chat.routes'));
      app.use('/api/v1/orders', require('./routes/order.routes'));
      app.use('/api/v1/guest', require('./routes/guest.routes'));
      console.log('[provider-service] Routes loaded successfully');
    } catch (error) {
      console.error('[provider-service] Error loading routes:', error);
      console.error('[provider-service] Error stack:', error.stack);
      process.exit(1);
    }

    // 404 cuando ninguna ruta coincide (para diagnosticar si las peticiones llegan al servicio)
    app.use((req, res) => {
      console.warn('[provider-service] 404:', req.method, req.originalUrl);
      res.status(404).json({ status: false, message: 'Route not found', path: req.originalUrl });
    });

    // Error handler (solo para errores pasados con next(err))
    app.use((err, _req, res, _next) => {
      const s = err.status || 500;
      res.status(s).json({ error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Internal error' } });
    });

    // Bind 0.0.0.0 para Railway
    const http = require('http');
    const { initializeSocket } = require('./socket');

    const server = http.createServer(app);
    initializeSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`provider-service on :${PORT}`);
      console.log(`[provider-service] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[provider-service] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    }).on('error', (err) => {
      console.error(`[provider-service] Failed to start:`, err);
      process.exit(1);
    });
  } catch (error) {
    console.error('[provider-service] Fatal error during startup:', error);
    console.error('[provider-service] Error stack:', error.stack);
    process.exit(1);
  }
})();
