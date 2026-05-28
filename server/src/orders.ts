import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from './db.js';
import type { Order, OrderItem, OrderStatus } from './types.js';

const router = Router();

const createOrderSchema = z.object({
  tableNumber: z.string().trim().min(1).max(20),
  serverName: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(500).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive().max(99)
    })
  ).min(1)
});

const statusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'cancelled'])
});

const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: []
};

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query<OrderRow>(`
      SELECT
        o.id,
        o.table_number,
        o.server_name,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at,
        COALESCE(SUM(oi.quantity * oi.price_cents), 0)::int AS total_cents,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', mi.id,
              'menuItemName', mi.name,
              'quantity', oi.quantity,
              'priceCents', oi.price_cents
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    res.json(rows.map(mapOrder));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid order payload', issues: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query<{ id: string }>(
      `
        INSERT INTO orders (table_number, server_name, notes)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [parsed.data.tableNumber, parsed.data.serverName, parsed.data.notes ?? null]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of parsed.data.items) {
      const menuResult = await client.query<{ price_cents: number }>(
        'SELECT price_cents FROM menu_items WHERE id = $1 AND is_available = TRUE',
        [item.menuItemId]
      );

      if (menuResult.rowCount === 0) {
        throw new OrderInputError(`Menu item ${item.menuItemId} is unavailable or does not exist.`);
      }

      await client.query(
        `
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents)
          VALUES ($1, $2, $3, $4)
        `,
        [orderId, item.menuItemId, item.quantity, menuResult.rows[0].price_cents]
      );
    }

    await client.query('COMMIT');

    const created = await getOrderById(orderId);
    res.status(201).json(created);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof OrderInputError) {
      res.status(400).json({ message: error.message });
      return;
    }

    next(error);
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res, next) => {
  const parsed = statusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid status payload' });
    return;
  }

  try {
    const current = await query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [req.params.id]);

    if (current.rowCount === 0) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const currentStatus = current.rows[0].status;
    const nextStatus = parsed.data.status;

    if (currentStatus !== nextStatus && !orderTransitions[currentStatus].includes(nextStatus)) {
      res.status(409).json({ message: `Cannot change order from ${currentStatus} to ${nextStatus}` });
      return;
    }

    await query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [nextStatus, req.params.id]
    );

    res.json(await getOrderById(req.params.id));
  } catch (error) {
    next(error);
  }
});

async function getOrderById(id: string) {
  const { rows } = await query<OrderRow>(
    `
      SELECT
        o.id,
        o.table_number,
        o.server_name,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at,
        COALESCE(SUM(oi.quantity * oi.price_cents), 0)::int AS total_cents,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', mi.id,
              'menuItemName', mi.name,
              'quantity', oi.quantity,
              'priceCents', oi.price_cents
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.id = $1
      GROUP BY o.id
    `,
    [id]
  );

  return rows[0] ? mapOrder(rows[0]) : null;
}

type OrderRow = {
  id: string;
  table_number: string;
  server_name: string;
  status: OrderStatus;
  notes: string | null;
  total_cents: number;
  created_at: Date;
  updated_at: Date;
  items: OrderItem[];
};

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    tableNumber: row.table_number,
    serverName: row.server_name,
    status: row.status,
    notes: row.notes,
    totalCents: row.total_cents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    items: row.items
  };
}

class OrderInputError extends Error {}

export default router;
