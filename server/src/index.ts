import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { pool } from './db.js';
import adminRouter from './admin.js';
import authRouter from './auth.js';
import menuItemsRouter from './menuItems.js';
import ordersRouter from './orders.js';
import { attachRequestId, logError, logRequest } from './requestLogging.js';
import realtimeRouter from './realtime.js';
import tablesRouter from './tables.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '../../client/dist');

app.use(attachRequestId);
app.use(logRequest);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'upgrade-insecure-requests': null
    }
  }
}));
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      service: 'restaurant-order-manager',
      environment: config.nodeEnv,
      database: 'connected'
    });
  } catch {
    res.status(503).json({
      ok: false,
      service: 'restaurant-order-manager',
      environment: config.nodeEnv,
      database: 'unavailable'
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/menu-items', menuItemsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/events', realtimeRouter);

if (config.nodeEnv === 'production') {
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logError('request_failed', err, {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl
  });

  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ message: 'Request body is too large', requestId: req.requestId });
    return;
  }

  if (isDatabaseConnectionError(err)) {
    res.status(503).json({
      message: 'Cannot connect to PostgreSQL. Start the database, then run npm.cmd run db:init.',
      requestId: req.requestId
    });
    return;
  }

  res.status(500).json({ message: 'Internal server error', requestId: req.requestId });
});

const server = app.listen(config.port, () => {
  console.log(`API server listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function isDatabaseConnectionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; errors?: Array<{ code?: string }> };

  return maybeError.code === 'ECONNREFUSED'
    || Boolean(maybeError.errors?.some((item) => item.code === 'ECONNREFUSED'));
}

function isPayloadTooLargeError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'type' in error
    && (error as { type?: string }).type === 'entity.too.large'
  );
}
