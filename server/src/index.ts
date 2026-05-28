import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import adminRouter from './admin.js';
import authRouter from './auth.js';
import menuItemsRouter from './menuItems.js';
import ordersRouter from './orders.js';

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'restaurant-order-manager' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/menu-items', menuItemsRouter);
app.use('/api/orders', ordersRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  if (isDatabaseConnectionError(err)) {
    res.status(503).json({
      message: 'Cannot connect to PostgreSQL. Start the database, then run npm.cmd run db:init.'
    });
    return;
  }

  res.status(500).json({ message: 'Internal server error' });
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
