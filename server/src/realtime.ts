import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from './authMiddleware.js';

type RealtimeEventType =
  | 'order_changed'
  | 'table_changed'
  | 'menu_changed'
  | 'staff_changed';

type RealtimeEvent = {
  type: RealtimeEventType;
  resourceId?: string;
  action: string;
  createdAt: string;
};

type Client = {
  id: number;
  write: (event: RealtimeEvent) => void;
};

const router = Router();
const clients = new Map<number, Client>();
let nextClientId = 1;

router.get('/', requireAuth, (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const clientId = nextClientId;
  nextClientId += 1;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const client: Client = {
    id: clientId,
    write(event) {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  clients.set(clientId, client);
  client.write({
    type: 'order_changed',
    action: 'connected',
    createdAt: new Date().toISOString()
  });

  const keepAlive = setInterval(() => {
    res.write(`: keep-alive ${new Date().toISOString()}\n\n`);
  }, 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(clientId);
  });

  console.log(JSON.stringify({
    level: 'info',
    message: 'realtime_client_connected',
    clientId,
    userId: user.id,
    role: user.role
  }));
});

export function broadcastRealtimeEvent(input: Omit<RealtimeEvent, 'createdAt'>) {
  const event = {
    ...input,
    createdAt: new Date().toISOString()
  };

  for (const client of clients.values()) {
    client.write(event);
  }
}

export default router;
