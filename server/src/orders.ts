import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthenticatedRequest } from './authMiddleware.js';
import { pool, query } from './db.js';
import { broadcastRealtimeEvent } from './realtime.js';
import type { FulfillmentType, Order, OrderEvent, OrderEventType, OrderItem, OrderItemStatus, OrderPayment, OrderSource, OrderStatus, PaymentMethod, PaymentStatus, TableStatus, User } from './types.js';

const router = Router();
const EXTRA_CHAIRS_ALLOWED = 2;
const TAX_RATE = 0.086;
const NON_KITCHEN_CATEGORIES = new Set(['Drinks']);

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
      menuItemId: z.string().uuid().optional(),
      menuItemVariantId: z.string().uuid().optional(),
      bundleId: z.string().uuid().optional(),
      quantity: z.number().int().positive().max(99)
    }).refine((value) => Boolean(value.bundleId) !== Boolean(value.menuItemId), {
      message: 'Order item must include either menuItemId or bundleId'
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

    if (value.fulfillmentType === 'dine_in' && !value.tableNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Table number is required for dine-in orders',
        path: ['tableNumber']
      });
    }

    if (value.fulfillmentType === 'dine_in' && !value.partySize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Party size is required for dine-in orders',
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
const itemStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served'])
});

const checkoutSchema = z.object({
  paymentMethod: z.enum(['cash', 'card']),
  orderItemIds: z.array(z.string().uuid()).min(1).optional(),
  subtotalCents: z.number().int().min(0),
  taxCents: z.number().int().min(0),
  tipCents: z.number().int().min(0),
  totalCents: z.number().int().min(0)
}).refine((value) => value.subtotalCents + value.taxCents + value.tipCents === value.totalCents, {
  message: 'Payment total must equal subtotal, tax, and tip'
});

const listOrdersSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'cancelled']).optional(),
  activeOnly: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
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
      where.push(`
        EXISTS (
          SELECT 1
          FROM order_items chef_oi
          JOIN menu_items chef_mi ON chef_mi.id = chef_oi.menu_item_id
          WHERE chef_oi.order_id = o.id
            AND chef_mi.category != 'Drinks'
            AND chef_oi.status IN ('pending', 'preparing')
        )
      `);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`o.status = $${params.length}`);
    }

    if (filters.activeOnly) {
      where.push(`o.status != 'cancelled'`);
      where.push(`o.payment_status != 'paid'`);
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
        p.payment_status,
        p.payment_method,
        p.payment_subtotal_cents,
        p.payment_tax_cents,
        p.payment_tip_cents,
        p.payment_total_cents,
        p.paid_at,
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
              'menuItemVariantId', miv.id,
              'menuItemName', mi.name,
              'menuItemCategory', mi.category,
              'variantName', miv.name,
              'bundleId', mb.id,
              'bundleName', mb.name,
              'quantity', oi.quantity,
              'priceCents', oi.price_cents,
              'status', oi.status,
              'preparedAt', oi.prepared_at,
              'servedAt', oi.served_at,
              'isKitchenItem', mi.category != 'Drinks',
              'paymentId', opi.payment_id
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', payments.id,
                'orderId', payments.order_id,
                'paymentMethod', payments.payment_method,
                'subtotalCents', payments.subtotal_cents,
                'taxCents', payments.tax_cents,
                'tipCents', payments.tip_cents,
                'totalCents', payments.total_cents,
                'actorName', payments.actor_name,
                'actorRole', payments.actor_role,
                'createdAt', payments.created_at,
                'itemIds', COALESCE(payments.item_ids, '[]'::json)
              )
              ORDER BY payments.created_at ASC
            )
            FROM (
              SELECT
                op.*,
                json_agg(opi_items.order_item_id ORDER BY opi_items.order_item_id) AS item_ids
              FROM order_payments op
              LEFT JOIN order_payment_items opi_items ON opi_items.payment_id = op.id
              WHERE op.order_id = p.id
              GROUP BY op.id
            ) payments
          ),
          '[]'
        ) AS payments
      FROM paged_orders p
      LEFT JOIN order_items oi ON oi.order_id = p.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_item_variants miv ON miv.id = oi.menu_item_variant_id
      LEFT JOIN menu_bundles mb ON mb.id = oi.bundle_id
      LEFT JOIN order_payment_items opi ON opi.order_item_id = oi.id
      GROUP BY p.id, p.order_source, p.fulfillment_type, p.table_number, p.party_size, p.phone_number, p.server_name, p.status, p.payment_status, p.payment_method, p.payment_subtotal_cents, p.payment_tax_cents, p.payment_tip_cents, p.payment_total_cents, p.paid_at, p.notes, p.created_at, p.updated_at, p.total_count
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

    if (parsed.data.fulfillmentType === 'dine_in' && parsed.data.tableNumber && parsed.data.partySize) {
      await occupyTable(client, parsed.data.tableNumber, parsed.data.partySize);
    }

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
        parsed.data.fulfillmentType === 'dine_in' ? parsed.data.tableNumber : null,
        parsed.data.fulfillmentType === 'dine_in' ? parsed.data.partySize : null,
        parsed.data.orderSource === 'phone' ? parsed.data.phoneNumber : null,
        parsed.data.serverName,
        parsed.data.notes ?? null
      ]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of parsed.data.items) {
      if (item.bundleId) {
        await insertBundleOrderItems(client, orderId, item.bundleId, item.quantity);
        continue;
      }

      if (!item.menuItemId) {
        throw new OrderInputError('Menu item id is required.');
      }

      const menuResult = await client.query<{ id: string; price_cents: number }>(
        `
          SELECT miv.id, miv.price_cents
          FROM menu_item_variants miv
          JOIN menu_items mi ON mi.id = miv.menu_item_id
          WHERE mi.id = $1
            AND miv.id = COALESCE($2, (
              SELECT default_variant.id
              FROM menu_item_variants default_variant
              WHERE default_variant.menu_item_id = mi.id
                AND default_variant.is_default = TRUE
              LIMIT 1
            ))
            AND mi.is_available = TRUE
            AND mi.is_sold_out = FALSE
        `,
        [item.menuItemId, item.menuItemVariantId ?? null]
      );

      if (menuResult.rowCount === 0) {
        throw new OrderInputError(`Menu item variant ${item.menuItemVariantId} is unavailable, sold out, or does not exist.`);
      }

      await insertUnitOrderItems(client, orderId, item.menuItemId, menuResult.rows[0].id, item.quantity, menuResult.rows[0].price_cents);
    }

    await insertOrderEvent(client, {
      orderId,
      eventType: 'order_created',
      actor: currentUser
    });

    await client.query('COMMIT');

    const created = await getOrderById(orderId);
    broadcastRealtimeEvent({ type: 'order_changed', action: 'created', resourceId: orderId });
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

    const current = await client.query<{
      status: OrderStatus;
      fulfillment_type: FulfillmentType;
      table_number: string | null;
    }>(
      'SELECT status, fulfillment_type, table_number FROM orders WHERE id = $1 FOR UPDATE',
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

    const currentOrder = current.rows[0];
    const nextTableNumber = parsed.data.fulfillmentType === 'dine_in' ? parsed.data.tableNumber ?? null : null;

    if (currentOrder.fulfillment_type === 'dine_in' && currentOrder.table_number && currentOrder.table_number !== nextTableNumber) {
      await setTableStatus(client, currentOrder.table_number, 'available');
    }

    if (parsed.data.fulfillmentType === 'dine_in' && nextTableNumber && parsed.data.partySize && nextTableNumber !== currentOrder.table_number) {
      await occupyTable(client, nextTableNumber, parsed.data.partySize);
    }

    if (parsed.data.fulfillmentType === 'dine_in' && nextTableNumber && parsed.data.partySize && nextTableNumber === currentOrder.table_number) {
      await validateTableCapacity(client, nextTableNumber, parsed.data.partySize);
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
        parsed.data.fulfillmentType === 'dine_in' ? parsed.data.tableNumber : null,
        parsed.data.fulfillmentType === 'dine_in' ? parsed.data.partySize : null,
        parsed.data.orderSource === 'phone' ? parsed.data.phoneNumber : null,
        parsed.data.serverName,
        parsed.data.notes ?? null,
        orderId
      ]
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

    for (const item of parsed.data.items) {
      if (item.bundleId) {
        await insertBundleOrderItems(client, orderId, item.bundleId, item.quantity);
        continue;
      }

      if (!item.menuItemId) {
        throw new OrderInputError('Menu item id is required.');
      }

      const menuResult = await client.query<{ id: string; price_cents: number }>(
        `
          SELECT miv.id, miv.price_cents
          FROM menu_item_variants miv
          JOIN menu_items mi ON mi.id = miv.menu_item_id
          WHERE mi.id = $1
            AND miv.id = COALESCE($2, (
              SELECT default_variant.id
              FROM menu_item_variants default_variant
              WHERE default_variant.menu_item_id = mi.id
                AND default_variant.is_default = TRUE
              LIMIT 1
            ))
            AND mi.is_available = TRUE
            AND mi.is_sold_out = FALSE
        `,
        [item.menuItemId, item.menuItemVariantId ?? null]
      );

      if (menuResult.rowCount === 0) {
        throw new OrderInputError(`Menu item variant ${item.menuItemVariantId} is unavailable, sold out, or does not exist.`);
      }

      await insertUnitOrderItems(client, orderId, item.menuItemId, menuResult.rows[0].id, item.quantity, menuResult.rows[0].price_cents);
    }

    await insertOrderEvent(client, {
      orderId,
      eventType: 'order_updated',
      actor: currentUser
    });

    await client.query('COMMIT');

    const updated = await getOrderById(orderId);
    broadcastRealtimeEvent({ type: 'order_changed', action: 'updated', resourceId: orderId });
    res.json(updated);
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

router.patch('/:orderId/items/:itemId/status', requireRole('staff', 'admin', 'chef'), async (req, res, next) => {
  const parsed = itemStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid item status payload' });
    return;
  }

  const client = await pool.connect();

  try {
    const orderId = String(req.params.orderId);
    const itemId = String(req.params.itemId);
    const nextStatus = parsed.data.status;
    const currentUser = (req as unknown as AuthenticatedRequest).user;

    await client.query('BEGIN');

    const current = await client.query<{
      status: OrderItemStatus;
      order_status: OrderStatus;
      category: string;
    }>(
      `
        SELECT oi.status, o.status AS order_status, mi.category
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.id = $1 AND oi.order_id = $2
        FOR UPDATE OF oi, o
      `,
      [itemId, orderId]
    );

    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Order item not found' });
      return;
    }

    if (current.rows[0].order_status === 'cancelled') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Cancelled orders cannot be updated' });
      return;
    }

    const currentStatus = current.rows[0].status;
    const isKitchenItem = !NON_KITCHEN_CATEGORIES.has(current.rows[0].category);

    if (currentStatus !== nextStatus && !itemTransitions[currentStatus].includes(nextStatus)) {
      if (!(currentUser.role === 'staff' && !isKitchenItem && currentStatus === 'pending' && nextStatus === 'served')) {
        await client.query('ROLLBACK');
        res.status(409).json({ message: `Cannot change item from ${currentStatus} to ${nextStatus}` });
        return;
      }
    }

    if (!isKitchenItem && currentUser.role === 'chef') {
      await client.query('ROLLBACK');
      res.status(403).json({ message: 'This item does not require kitchen preparation' });
      return;
    }

    if (currentUser.role !== 'admin' && !isRoleAllowedItemTransition(currentUser.role, currentStatus, nextStatus, isKitchenItem)) {
      await client.query('ROLLBACK');
      res.status(403).json({ message: 'You do not have permission to make this item status change' });
      return;
    }

    await client.query(
      `
        UPDATE order_items
        SET
          status = $1,
          prepared_at = CASE WHEN $1 IN ('ready', 'served') AND prepared_at IS NULL THEN NOW() ELSE prepared_at END,
          served_at = CASE WHEN $1 = 'served' AND served_at IS NULL THEN NOW() ELSE served_at END
        WHERE id = $2 AND order_id = $3
      `,
      [nextStatus, itemId, orderId]
    );

    await syncOrderStatusFromItems(client, orderId, currentUser);
    await client.query('COMMIT');

    const updated = await getOrderById(orderId);
    broadcastRealtimeEvent({ type: 'order_changed', action: 'item_status_changed', resourceId: orderId });
    res.json(updated);
  } catch (error) {
    await client.query('ROLLBACK');
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
          payment_method,
          payment_total_cents,
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

    const current = await client.query<{
      status: OrderStatus;
      fulfillment_type: FulfillmentType;
      table_number: string | null;
    }>('SELECT status, fulfillment_type, table_number FROM orders WHERE id = $1 FOR UPDATE', [orderId]);

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
    await updateOrderItemsForOrderStatus(client, orderId, nextStatus);

    if (current.rows[0].fulfillment_type === 'dine_in' && current.rows[0].table_number) {
      if (nextStatus === 'served') {
        await setTableStatus(client, current.rows[0].table_number, 'needs_cleaning');
      }

      if (nextStatus === 'cancelled') {
        await setTableStatus(client, current.rows[0].table_number, 'available');
      }
    }

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

    const updated = await getOrderById(orderId);
    broadcastRealtimeEvent({ type: 'order_changed', action: 'status_changed', resourceId: orderId });
    res.json(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.post('/:id/checkout', requireRole('staff', 'admin'), async (req, res, next) => {
  const parsed = checkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid checkout payload', issues: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();

  try {
    const orderId = String(req.params.id);
    const currentUser = (req as unknown as AuthenticatedRequest).user;

    await client.query('BEGIN');

    const current = await client.query<{
      status: OrderStatus;
      payment_status: PaymentStatus;
    }>(
      `
        SELECT
          o.status,
          o.payment_status
        FROM orders o
        WHERE o.id = $1
        FOR UPDATE OF o
      `,
      [orderId]
    );

    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (current.rows[0].status !== 'served') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Only served orders can be checked out' });
      return;
    }

    if (current.rows[0].payment_status === 'paid') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Order has already been paid' });
      return;
    }

    const isItemBasedPayment = parsed.data.orderItemIds !== undefined;
    const selectedItems = isItemBasedPayment
      ? await client.query<{ id: string; quantity: number; price_cents: number }>(
        `
          SELECT oi.id, oi.quantity, oi.price_cents
          FROM order_items oi
          LEFT JOIN order_payment_items opi ON opi.order_item_id = oi.id
          WHERE oi.order_id = $1
            AND oi.id = ANY($2::uuid[])
            AND opi.order_item_id IS NULL
          FOR UPDATE OF oi
        `,
        [orderId, parsed.data.orderItemIds]
      )
      : { rows: [], rowCount: 0 };

    const selectedIds = selectedItems.rows.map((item) => item.id);

    if (isItemBasedPayment && selectedIds.length === 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'No unpaid order items were selected for checkout' });
      return;
    }

    if (parsed.data.orderItemIds && selectedIds.length !== new Set(parsed.data.orderItemIds).size) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'One or more selected order items are already paid or do not belong to this order' });
      return;
    }

    const balance = await client.query<{ order_subtotal_cents: number; paid_subtotal_cents: number }>(
      `
        SELECT
          COALESCE((SELECT SUM(quantity * price_cents) FROM order_items WHERE order_id = $1), 0)::int AS order_subtotal_cents,
          COALESCE((SELECT SUM(subtotal_cents) FROM order_payments WHERE order_id = $1), 0)::int AS paid_subtotal_cents
      `,
      [orderId]
    );
    const remainingSubtotalCents = Math.max(0, balance.rows[0].order_subtotal_cents - balance.rows[0].paid_subtotal_cents);
    const expectedSubtotalCents = isItemBasedPayment
      ? selectedItems.rows.reduce((sum, item) => sum + item.quantity * item.price_cents, 0)
      : parsed.data.subtotalCents;
    const expectedTaxCents = Math.round(expectedSubtotalCents * TAX_RATE);

    if (isItemBasedPayment && parsed.data.subtotalCents !== expectedSubtotalCents) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Checkout subtotal does not match current order total' });
      return;
    }

    if (!isItemBasedPayment && (parsed.data.subtotalCents <= 0 || parsed.data.subtotalCents > remainingSubtotalCents)) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Checkout amount exceeds remaining order balance' });
      return;
    }

    if (parsed.data.taxCents !== expectedTaxCents) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Checkout tax does not match configured tax rate' });
      return;
    }

    const paymentResult = await client.query<{ id: string }>(
      `
        INSERT INTO order_payments (
          order_id,
          payment_method,
          subtotal_cents,
          tax_cents,
          tip_cents,
          total_cents,
          actor_user_id,
          actor_name,
          actor_role
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      [
        orderId,
        parsed.data.paymentMethod,
        parsed.data.subtotalCents,
        parsed.data.taxCents,
        parsed.data.tipCents,
        parsed.data.totalCents,
        currentUser.id,
        currentUser.name,
        currentUser.role
      ]
    );

    for (const itemId of selectedIds) {
      await client.query(
        'INSERT INTO order_payment_items (payment_id, order_item_id) VALUES ($1, $2)',
        [paymentResult.rows[0].id, itemId]
      );
    }

    await syncOrderPaymentSummary(client, orderId);

    await insertOrderEvent(client, {
      orderId,
      eventType: 'payment_recorded',
      paymentMethod: parsed.data.paymentMethod,
      paymentTotalCents: parsed.data.totalCents,
      actor: currentUser
    });

    await client.query('COMMIT');

    const updated = await getOrderById(orderId);
    broadcastRealtimeEvent({ type: 'order_changed', action: 'payment_recorded', resourceId: orderId });
    res.json(updated);
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
        o.payment_status,
        o.payment_method,
        o.payment_subtotal_cents,
        o.payment_tax_cents,
        o.payment_tip_cents,
        o.payment_total_cents,
        o.paid_at,
        o.notes,
        o.created_at,
        o.updated_at,
        COALESCE(SUM(oi.quantity * oi.price_cents), 0)::int AS total_cents,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', mi.id,
              'menuItemVariantId', miv.id,
              'menuItemName', mi.name,
              'menuItemCategory', mi.category,
              'variantName', miv.name,
              'bundleId', mb.id,
              'bundleName', mb.name,
              'quantity', oi.quantity,
              'priceCents', oi.price_cents,
              'status', oi.status,
              'preparedAt', oi.prepared_at,
              'servedAt', oi.served_at,
              'isKitchenItem', mi.category != 'Drinks',
              'paymentId', opi.payment_id
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', payments.id,
                'orderId', payments.order_id,
                'paymentMethod', payments.payment_method,
                'subtotalCents', payments.subtotal_cents,
                'taxCents', payments.tax_cents,
                'tipCents', payments.tip_cents,
                'totalCents', payments.total_cents,
                'actorName', payments.actor_name,
                'actorRole', payments.actor_role,
                'createdAt', payments.created_at,
                'itemIds', COALESCE(payments.item_ids, '[]'::json)
              )
              ORDER BY payments.created_at ASC
            )
            FROM (
              SELECT
                op.*,
                json_agg(opi_items.order_item_id ORDER BY opi_items.order_item_id) AS item_ids
              FROM order_payments op
              LEFT JOIN order_payment_items opi_items ON opi_items.payment_id = op.id
              WHERE op.order_id = o.id
              GROUP BY op.id
            ) payments
          ),
          '[]'
        ) AS payments
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_item_variants miv ON miv.id = oi.menu_item_variant_id
      LEFT JOIN menu_bundles mb ON mb.id = oi.bundle_id
      LEFT JOIN order_payment_items opi ON opi.order_item_id = oi.id
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
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_subtotal_cents: number | null;
  payment_tax_cents: number | null;
  payment_tip_cents: number | null;
  payment_total_cents: number | null;
  paid_at: Date | null;
  notes: string | null;
  total_cents: number;
  created_at: Date;
  updated_at: Date;
  items: OrderItem[];
  payments: OrderPayment[];
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
  payment_method: PaymentMethod | null;
  payment_total_cents: number | null;
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
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentSubtotalCents: row.payment_subtotal_cents,
    paymentTaxCents: row.payment_tax_cents,
    paymentTipCents: row.payment_tip_cents,
    paymentTotalCents: row.payment_total_cents,
    paidAt: row.paid_at?.toISOString() ?? null,
    notes: row.notes,
    totalCents: row.total_cents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    items: row.items,
    payments: row.payments.map((payment) => ({
      ...payment,
      createdAt: new Date(payment.createdAt).toISOString()
    }))
  };
}

const itemTransitions: Record<OrderItemStatus, OrderItemStatus[]> = {
  pending: ['preparing'],
  preparing: ['ready'],
  ready: ['served'],
  served: []
};

function mapOrderEvent(row: OrderEventRow): OrderEvent {
  return {
    id: row.id,
    orderId: row.order_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    paymentMethod: row.payment_method,
    paymentTotalCents: row.payment_total_cents,
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
    paymentMethod?: PaymentMethod;
    paymentTotalCents?: number;
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
        payment_method,
        payment_total_cents,
        actor_user_id,
        actor_name,
        actor_role
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      input.orderId,
      input.eventType,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.paymentMethod ?? null,
      input.paymentTotalCents ?? null,
      input.actor.id,
      input.actor.name,
      input.actor.role
    ]
  );
}

async function syncOrderPaymentSummary(client: PoolClient, orderId: string) {
  const summary = await client.query<{
    subtotal_cents: number;
    tax_cents: number;
    tip_cents: number;
    total_cents: number;
    payment_method: PaymentMethod | null;
    order_subtotal_cents: number;
  }>(
    `
      SELECT
        COALESCE(SUM(op.subtotal_cents), 0)::int AS subtotal_cents,
        COALESCE(SUM(op.tax_cents), 0)::int AS tax_cents,
        COALESCE(SUM(op.tip_cents), 0)::int AS tip_cents,
        COALESCE(SUM(op.total_cents), 0)::int AS total_cents,
        CASE WHEN COUNT(DISTINCT op.payment_method) = 1 THEN MIN(op.payment_method) ELSE NULL END AS payment_method,
        (
          SELECT COALESCE(SUM(quantity * price_cents), 0)::int
          FROM order_items
          WHERE order_id = $1
        ) AS order_subtotal_cents
      FROM order_payments op
      WHERE op.order_id = $1
    `,
    [orderId]
  );

  const row = summary.rows[0];
  const paymentStatus = row.subtotal_cents === 0
    ? 'unpaid'
    : row.subtotal_cents >= row.order_subtotal_cents
      ? 'paid'
      : 'partially_paid';

  await client.query(
    `
      UPDATE orders
      SET
        payment_status = $1,
        payment_method = $2,
        payment_subtotal_cents = $3,
        payment_tax_cents = $4,
        payment_tip_cents = $5,
        payment_total_cents = $6,
        paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
      WHERE id = $7
    `,
    [
      paymentStatus,
      row.payment_method,
      row.subtotal_cents,
      row.tax_cents,
      row.tip_cents,
      row.total_cents,
      orderId
    ]
  );
}

async function insertUnitOrderItems(
  client: PoolClient,
  orderId: string,
  menuItemId: string,
  menuItemVariantId: string,
  quantity: number,
  priceCents: number
) {
  for (let index = 0; index < quantity; index += 1) {
    await client.query(
      `
        INSERT INTO order_items (order_id, menu_item_id, menu_item_variant_id, quantity, price_cents)
        VALUES ($1, $2, $3, 1, $4)
      `,
        [orderId, menuItemId, menuItemVariantId, priceCents]
    );
  }
}

async function insertBundleOrderItems(client: PoolClient, orderId: string, bundleId: string, quantity: number) {
  const bundle = await client.query<{
    bundle_id: string;
    bundle_name: string;
    bundle_price_cents: number;
    menu_item_id: string;
    menu_item_variant_id: string;
    component_quantity: number;
    component_price_cents: number;
  }>(
    `
      SELECT
        mb.id AS bundle_id,
        mb.name AS bundle_name,
        mb.price_cents AS bundle_price_cents,
        mi.id AS menu_item_id,
        miv.id AS menu_item_variant_id,
        mbi.quantity AS component_quantity,
        miv.price_cents AS component_price_cents
      FROM menu_bundles mb
      JOIN menu_bundle_items mbi ON mbi.bundle_id = mb.id
      JOIN menu_item_variants miv ON miv.id = mbi.menu_item_variant_id
      JOIN menu_items mi ON mi.id = miv.menu_item_id
      WHERE mb.id = $1
        AND mb.is_available = TRUE
        AND mb.is_sold_out = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM menu_bundle_items component
          JOIN menu_item_variants component_variant ON component_variant.id = component.menu_item_variant_id
          JOIN menu_items component_item ON component_item.id = component_variant.menu_item_id
          WHERE component.bundle_id = mb.id
            AND (component_item.is_available = FALSE OR component_item.is_sold_out = TRUE)
        )
        AND mi.is_available = TRUE
        AND mi.is_sold_out = FALSE
      ORDER BY mi.category, mi.name
    `,
    [bundleId]
  );

  if (bundle.rowCount === 0) {
    throw new OrderInputError(`Menu bundle ${bundleId} is unavailable, sold out, or does not exist.`);
  }

  const components = bundle.rows.flatMap((row) => (
    Array.from({ length: row.component_quantity }, () => row)
  ));
  const regularTotal = components.reduce((sum, component) => sum + component.component_price_cents, 0);

  for (let bundleIndex = 0; bundleIndex < quantity; bundleIndex += 1) {
    let allocatedTotal = 0;

    for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
      const component = components[componentIndex];
      const isLastComponent = componentIndex === components.length - 1;
      const priceCents = isLastComponent
        ? component.bundle_price_cents - allocatedTotal
        : Math.round((component.component_price_cents / regularTotal) * component.bundle_price_cents);

      allocatedTotal += priceCents;

      await client.query(
        `
          INSERT INTO order_items (order_id, menu_item_id, menu_item_variant_id, bundle_id, quantity, price_cents)
          VALUES ($1, $2, $3, $4, 1, $5)
        `,
        [orderId, component.menu_item_id, component.menu_item_variant_id, component.bundle_id, priceCents]
      );
    }
  }
}

async function occupyTable(client: PoolClient, tableNumber: string, partySize: number) {
  const tableResult = await client.query<{ status: TableStatus; capacity: number }>(
    'SELECT status, capacity FROM restaurant_tables WHERE name = $1 FOR UPDATE',
    [tableNumber]
  );

  if (tableResult.rowCount === 0) {
    throw new OrderInputError(`Table ${tableNumber} does not exist.`);
  }

  validatePartySizeForTable(tableNumber, partySize, tableResult.rows[0].capacity);

  if (tableResult.rows[0].status !== 'available') {
    throw new OrderInputError(`Table ${tableNumber} is not available.`);
  }

  await setTableStatus(client, tableNumber, 'occupied');
}

async function validateTableCapacity(client: PoolClient, tableNumber: string, partySize: number) {
  const tableResult = await client.query<{ capacity: number }>(
    'SELECT capacity FROM restaurant_tables WHERE name = $1 FOR UPDATE',
    [tableNumber]
  );

  if (tableResult.rowCount === 0) {
    throw new OrderInputError(`Table ${tableNumber} does not exist.`);
  }

  validatePartySizeForTable(tableNumber, partySize, tableResult.rows[0].capacity);
}

function validatePartySizeForTable(tableNumber: string, partySize: number, capacity: number) {
  const maxPartySize = capacity + EXTRA_CHAIRS_ALLOWED;

  if (partySize > maxPartySize) {
    throw new OrderInputError(`Table ${tableNumber} seats ${capacity}. Maximum party size is ${maxPartySize} with extra chairs.`);
  }
}

async function setTableStatus(client: PoolClient, tableNumber: string, status: TableStatus) {
  await client.query(
    'UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE name = $2',
    [status, tableNumber]
  );
}

async function updateOrderItemsForOrderStatus(client: PoolClient, orderId: string, status: OrderStatus) {
  if (status === 'preparing') {
    await client.query(
      "UPDATE order_items SET status = 'preparing' WHERE order_id = $1 AND status = 'pending'",
      [orderId]
    );
  }

  if (status === 'ready') {
    await client.query(
      `
        UPDATE order_items
        SET status = 'ready', prepared_at = COALESCE(prepared_at, NOW())
        WHERE order_id = $1 AND status IN ('pending', 'preparing')
      `,
      [orderId]
    );
  }

  if (status === 'served') {
    await client.query(
      `
        UPDATE order_items
        SET
          status = 'served',
          prepared_at = COALESCE(prepared_at, NOW()),
          served_at = COALESCE(served_at, NOW())
        WHERE order_id = $1 AND status != 'served'
      `,
      [orderId]
    );
  }
}

async function syncOrderStatusFromItems(client: PoolClient, orderId: string, actor: User) {
  const current = await client.query<{
    status: OrderStatus;
    fulfillment_type: FulfillmentType;
    table_number: string | null;
  }>(
    'SELECT status, fulfillment_type, table_number FROM orders WHERE id = $1 FOR UPDATE',
    [orderId]
  );

  if (current.rowCount === 0 || current.rows[0].status === 'cancelled') {
    return;
  }

  const items = await client.query<{ status: OrderItemStatus }>(
    'SELECT status FROM order_items WHERE order_id = $1',
    [orderId]
  );
  const statuses = items.rows.map((item) => item.status);
  const nextStatus = deriveOrderStatusFromItems(statuses);
  const currentStatus = current.rows[0].status;

  if (nextStatus === currentStatus) {
    return;
  }

  await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, orderId]);

  if (current.rows[0].fulfillment_type === 'dine_in' && current.rows[0].table_number && nextStatus === 'served') {
    await setTableStatus(client, current.rows[0].table_number, 'needs_cleaning');
  }

  await insertOrderEvent(client, {
    orderId,
    eventType: 'status_changed',
    fromStatus: currentStatus,
    toStatus: nextStatus,
    actor
  });
}

function deriveOrderStatusFromItems(statuses: OrderItemStatus[]): OrderStatus {
  if (statuses.length === 0 || statuses.every((status) => status === 'pending')) {
    return 'pending';
  }

  if (statuses.every((status) => status === 'served')) {
    return 'served';
  }

  if (statuses.every((status) => status === 'ready' || status === 'served')) {
    return 'ready';
  }

  return 'preparing';
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

function isRoleAllowedItemTransition(
  role: 'staff' | 'chef',
  currentStatus: OrderItemStatus,
  nextStatus: OrderItemStatus,
  isKitchenItem: boolean
) {
  if (role === 'chef') {
    if (!isKitchenItem) {
      return false;
    }

    return (currentStatus === 'pending' && nextStatus === 'preparing')
      || (currentStatus === 'preparing' && nextStatus === 'ready');
  }

  return (currentStatus === 'ready' && nextStatus === 'served')
    || (!isKitchenItem && currentStatus === 'pending' && nextStatus === 'served');
}

export default router;
