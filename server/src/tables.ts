import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthenticatedRequest } from './authMiddleware.js';
import { query } from './db.js';
import { broadcastRealtimeEvent } from './realtime.js';
import type { RestaurantTable, TableStatus } from './types.js';

const router = Router();

router.use(requireAuth);

const createTableSchema = z.object({
  name: z.string().trim().min(1).max(20),
  capacity: z.number().int().positive().max(99).default(4)
});

const updateTableSchema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  capacity: z.number().int().positive().max(99).optional(),
  status: z.enum(['available', 'occupied', 'needs_cleaning']).optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one table field is required'
});

router.get('/', requireRole('staff', 'admin', 'chef'), async (_req, res, next) => {
  try {
    const { rows } = await query<TableRow>(
      `
        SELECT id, name, capacity, status, created_at, updated_at
        FROM restaurant_tables
        ORDER BY NULLIF(regexp_replace(name, '\\D', '', 'g'), '')::int NULLS LAST, name
      `
    );

    res.json(rows.map(mapTable));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ message: 'A table with this name already exists' });
      return;
    }

    next(error);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  const parsed = createTableSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid table payload', issues: parsed.error.flatten() });
    return;
  }

  try {
    const { rows } = await query<TableRow>(
      `
        INSERT INTO restaurant_tables (name, capacity)
        VALUES ($1, $2)
        RETURNING id, name, capacity, status, created_at, updated_at
      `,
      [parsed.data.name, parsed.data.capacity]
    );

    const table = mapTable(rows[0]);
    broadcastRealtimeEvent({ type: 'table_changed', action: 'created', resourceId: table.id });
    res.status(201).json(table);
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ message: 'A table with this name already exists' });
      return;
    }

    next(error);
  }
});

router.patch('/:id', requireRole('staff', 'admin'), async (req, res, next) => {
  const parsed = updateTableSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid table payload', issues: parsed.error.flatten() });
    return;
  }

  const currentUser = (req as unknown as AuthenticatedRequest).user;

  if (currentUser.role === 'staff') {
    const isCleaningCompleteUpdate = parsed.data.status === 'available'
      && parsed.data.name === undefined
      && parsed.data.capacity === undefined;

    if (!isCleaningCompleteUpdate) {
      res.status(403).json({ message: 'Staff can only mark a table as cleaned' });
      return;
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (parsed.data.name !== undefined) {
    params.push(parsed.data.name);
    updates.push(`name = $${params.length}`);
  }

  if (parsed.data.capacity !== undefined) {
    params.push(parsed.data.capacity);
    updates.push(`capacity = $${params.length}`);
  }

  if (parsed.data.status !== undefined) {
    params.push(parsed.data.status);
    updates.push(`status = $${params.length}`);
  }

  params.push(req.params.id);

  try {
    if (currentUser.role === 'staff') {
      const current = await query<{ status: TableStatus }>('SELECT status FROM restaurant_tables WHERE id = $1', [req.params.id]);

      if (current.rowCount === 0) {
        res.status(404).json({ message: 'Table not found' });
        return;
      }

      if (current.rows[0].status !== 'needs_cleaning') {
        res.status(409).json({ message: 'Only tables that need cleaning can be marked as cleaned' });
        return;
      }
    }

    const { rows } = await query<TableRow>(
      `
        UPDATE restaurant_tables
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length}
        RETURNING id, name, capacity, status, created_at, updated_at
      `,
      params
    );

    if (rows.length === 0) {
      res.status(404).json({ message: 'Table not found' });
      return;
    }

    const table = mapTable(rows[0]);
    broadcastRealtimeEvent({ type: 'table_changed', action: 'updated', resourceId: table.id });
    res.json(table);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM restaurant_tables WHERE id = $1 AND status != $2',
      [req.params.id, 'occupied']
    );

    if (rowCount === 0) {
      res.status(409).json({ message: 'Table not found or currently occupied' });
      return;
    }

    broadcastRealtimeEvent({ type: 'table_changed', action: 'deleted', resourceId: String(req.params.id) });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

type TableRow = {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  created_at: Date;
  updated_at: Date;
};

function mapTable(row: TableRow): RestaurantTable {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

export default router;
