import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthenticatedRequest } from './authMiddleware.js';
import { pool, query } from './db.js';
import type { FulfillmentType, Order, OrderEvent, OrderEventType, OrderItem, OrderSource, OrderStatus, User } from './types.js';

const router = Router();

router.use(requireAuth);

const createOrderSchema = z.object({
  orderSource: z.enum(['in_person', 'phone']),
  fulfillmentType: z.enum(['dine_in', 'to_go', 'pickup', 'delivery']),
  tableNumber: z.string().trim().max(20).optional(),
  partySize: z.number().int().positive().max(99).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  serverName: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(500).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive().max(99)
    })
  ).min(1)
}).superRefine((value, ctx) => {
  if (value.orderSource === 'in_person') {
    if (!['dine_in', 'to_go'].includes(value.fulfillmentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'In-person orders must be dine-in or to-go',
        path: ['fulfillmentType']
      });
    }

    if (!value.tableNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Table number is required for in-person orders',
        path: ['tableNumber']
      });
    }

    if (!value.partySize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Party size is required for in-person orders',
        path: ['partySize']
      });
    }
  }

  if (value.orderSource === 'phone') {
    if (!['pickup', 'delivery'].includes(value.fulfillmentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone orders must be pickup or delivery',
        path: ['fulfillmentType']
      });
    }

    if (!value.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone number is required for phone orders',
        path: ['phoneNumber']
      });
    }
  }
});

const updateOrderSchema = createOrderSchema;

const statusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'cancelled'])
});

const listOrdersSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'cancelled']).optional(),
  tableNumber: z.string().trim().max(20).optional(),
  serverName: z.string().trim().max(80).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: []
};

router.get('/', requireRole('staff', 'admin', 'chef'), async (req, res, next) => {
  const parsed = listOrdersSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid order filters', issues: parsed.error.flatten() });
    return;
  }

  try {
    const filters = parsed.data;
    const currentUser = (req as unknown as AuthenticatedRequest).user;
    const params: unknown[] = [];
    const where: string[] = [];

    if (currentUser.role === 'chef') {
      where.push(`o.status IN ('pending', 'preparing')`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`o.status = $${params.length}`);
    }

    if (filters.tableNumber) {
      params.push(`%${filters.tableNumber}%`);
      where.push(`o.table_number ILIKE $${params.length}`);
    }

    if (filters.serverName) {
      params.push(`%${filters.serverName}%`);
      where.push(`o.server_name ILIKE $${params.length}`);
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      where.push(`o.created_at >= $${params.length}::date`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      where.push(`o.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    params.push(filters.limit);
    const limitParam = params.length;
    params.push((filters.page - 1) * filters.limit);
    const offsetParam = params.length;

    const { rows } = await query<OrderListRow>(`
      WITH filtered_orders AS (
        SELECT o.*
        FROM orders o
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ),
      paged_orders AS (
        SELECT *, COUNT(*) OVER()::int AS total_count
        FROM filtered_orders
        ORDER BY created_at DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      )
      SELECT
        p.id,
        p.order_source,
        p.fulfillment_type,
        p.table_number,
        p.party_size,
        p.phone_number,
        p.server_name,
        p.status,
        p.notes,
        p.created_at,
        p.updated_at,
        p.total_count,
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
      FROM paged_orders p
      LEFT JOIN order_items oi ON oi.order_id = p.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      GROUP BY p.id, p.order_source, p.fulfillment_type, p.table_number, p.party_size, p.phone_number, p.server_name, p.status, p.notes, p.created_at, p.updated_at, p.total_count
      ORDER BY p.created_at DESC
    `, params);

    const total = rows[0]?.total_count ?? 0;

    res.json({
      orders: rows.map(mapOrder),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('staff', 'admin'), async (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid order payload', issues: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();

  try {
    const currentUser = (req as unknown as AuthenticatedRequest).user;

    await client.query('BEGIN');

    const orderResult = await client.query<{ id: string }>(
      `
        INSERT INTO orders (
          order_source,
          fulfillment_type,
          table_number,
          party_size,
          phone_number,
          server_name,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        parsed.data.orderSource,
        parsed.data.fulfillmentType,
        parsed.data.orderSource === 'in_person' ? parsed.data.tableNumber : null,
        parsed.data.orderSource === 'in_person' ? parsed.data.partySize : null,
        parsed.data.orderSource === 'phone' ? parsed.data.phoneNumber : null,
        parsed.data.serverName,
        parsed.data.notes ?? null
      ]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of parsed.data.items) {
      const menuResult = await client.query<{ price_cents: number }>(
        'SELECT price_cents FROM menu_items WHERE id = $1 AND is_available = TRUE AND is_sold_out = FALSE',
        [item.menuItemId]
      );

      if (menuResult.rowCount === 0) {
        throw new OrderInputError(`Menu item ${item.menuItemId} is unavailable, sold out, or does not exist.`);
      }

      await client.query(
        `
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents)
          VALUES ($1, $2, $3, $4)
        `,
        [orderId, item.menuItemId, item.quantity, menuResult.rows[0].price_cents]
      );
    }

    await insertOrderEvent(client, {
      orderId,
      eventType: 'order_created',
      actor: currentUser
    });

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

router.patch('/:id', requireRole('staff', 'admin'), async (req, res, next) => {
  const parsed = updateOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid order payload', issues: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();

  try {
    const orderId = String(req.params.id);
    const currentUser = (req as unknown as AuthenticatedRequest).user;

    await client.query('BEGIN');

    const current = await client.query<{ status: OrderStatus }>(
      'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (current.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Only pending orders can be edited' });
      return;
    }

    await client.query(
      `
        UPDATE orders
        SET
          order_source = $1,
          fulfillment_type = $2,
          table_number = $3,
          party_size = $4,
          phone_number = $5,
          server_name = $6,
          notes = $7,
          updated_at = NOW()
        WHERE id = $8
      `,
      [
        parsed.data.orderSource,
        parsed.data.fulfillmentType,
        parsed.data.orderSource === 'in_person' ? parsed.data.tableNumber : null,
        parsed.data.orderSource === 'in_person' ? parsed.data.partySize : null,
        parsed.data.orderSource === 'phone' ? parsed.data.phoneNumber : null,
        parsed.data.serverName,
        parsed.data.notes ?? null,
        orderId
      ]
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

    for (const item of parsed.data.items) {
      const menuResult = await client.query<{ price_cents: number }>(
        'SELECT price_cents FROM menu_items WHERE id = $1 AND is_available = TRUE AND is_sold_out = FALSE',
        [item.menuItemId]
      );

      if (menuResult.rowCount === 0) {
        throw new OrderInputError(`Menu item ${item.menuItemId} is unavailable, sold out, or does not exist.`);
      }

      await client.query(
        `
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents)
          VALUES ($1, $2, $3, $4)
        `,
        [orderId, item.menuItemId, item.quantity, menuResult.rows[0].price_cents]
      );
    }

    await insertOrderEvent(client, {
      orderId,
      eventType: 'order_updated',
      actor: currentUser
    });

    await client.query('COMMIT');

    res.json(await getOrderById(orderId));
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

router.get('/:id/events', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query<OrderEventRow>(
      `
        SELECT
          id,
          order_id,
          event_type,
          from_status,
          to_status,
          actor_user_id,
          actor_name,
          actor_role,
          created_at
        FROM order_events
        WHERE order_id = $1
        ORDER BY created_at ASC
      `,
      [req.params.id]
    );

    res.json(rows.map(mapOrderEvent));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireRole('staff', 'admin', 'chef'), async (req, res, next) => {
  const parsed = statusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid status payload' });
    return;
  }

  const client = await pool.connect();

  try {
    const orderId = String(req.params.id);
    await client.query('BEGIN');

    const current = await client.query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);

    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const currentStatus = current.rows[0].status;
    const nextStatus = parsed.data.status;
    const currentUser = (req as unknown as AuthenticatedRequest).user;

    if (currentStatus !== nextStatus && !orderTransitions[currentStatus].includes(nextStatus)) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: `Cannot change order from ${currentStatus} to ${nextStatus}` });
      return;
    }

    if (currentUser.role !== 'admin' && !isRoleAllowedTransition(currentUser.role, currentStatus, nextStatus)) {
      await client.query('ROLLBACK');
      res.status(403).json({ message: 'You do not have permission to make this status change' });
      return;
    }

    await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [nextStatus, orderId]
    );

    if (currentStatus !== nextStatus) {
      await insertOrderEvent(client, {
        orderId,
        eventType: 'status_changed',
        fromStatus: currentStatus,
        toStatus: nextStatus,
        actor: currentUser
      });
    }

    await client.query('COMMIT');

    res.json(await getOrderById(orderId));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

async function getOrderById(id: string) {
  const { rows } = await query<OrderRow>(
    `
      SELECT
        o.id,
        o.order_source,
        o.fulfillment_type,
        o.table_number,
        o.party_size,
        o.phone_number,
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
  order_source: OrderSource;
  fulfillment_type: FulfillmentType;
  table_number: string | null;
  party_size: number | null;
  phone_number: string | null;
  server_name: string;
  status: OrderStatus;
  notes: string | null;
  total_cents: number;
  created_at: Date;
  updated_at: Date;
  items: OrderItem[];
};

type OrderListRow = OrderRow & {
  total_count: number;
};

type OrderEventRow = {
  id: string;
  order_id: string;
  event_type: OrderEventType;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  actor_user_id: string | null;
  actor_name: string;
  actor_role: User['role'];
  created_at: Date;
};

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderSource: row.order_source,
    fulfillmentType: row.fulfillment_type,
    tableNumber: row.table_number,
    partySize: row.party_size,
    phoneNumber: row.phone_number,
    serverName: row.server_name,
    status: row.status,
    notes: row.notes,
    totalCents: row.total_cents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    items: row.items
  };
}

function mapOrderEvent(row: OrderEventRow): OrderEvent {
  return {
    id: row.id,
    orderId: row.order_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    createdAt: row.created_at.toISOString()
  };
}

async function insertOrderEvent(
  client: PoolClient,
  input: {
    orderId: string;
    eventType: OrderEventType;
    fromStatus?: OrderStatus;
    toStatus?: OrderStatus;
    actor: User;
  }
) {
  await client.query(
    `
      INSERT INTO order_events (
        order_id,
        event_type,
        from_status,
        to_status,
        actor_user_id,
        actor_name,
        actor_role
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.orderId,
      input.eventType,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.actor.id,
      input.actor.name,
      input.actor.role
    ]
  );
}

class OrderInputError extends Error {}

function isRoleAllowedTransition(role: 'staff' | 'chef', currentStatus: OrderStatus, nextStatus: OrderStatus) {
  if (role === 'chef') {
    return (currentStatus === 'pending' && nextStatus === 'preparing')
      || (currentStatus === 'preparing' && nextStatus === 'ready');
  }

  return (currentStatus === 'pending' && nextStatus === 'cancelled')
    || (currentStatus === 'ready' && nextStatus === 'served');
}

export default router;
