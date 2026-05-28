import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from './authMiddleware.js';
import { query } from './db.js';
import type { MenuItem } from './types.js';

const router = Router();
const menuCategories = ['Entrees', 'Vegetables', 'Small Plates', 'Drinks', 'Desserts'] as const;

const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(menuCategories),
  priceCents: z.number().int().min(0).max(100000),
  isAvailable: z.boolean().default(true)
});

const updateMenuItemSchema = menuItemSchema.partial();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query<MenuItemRow>(`
      SELECT id, name, category, price_cents, is_available
      FROM menu_items
      WHERE is_available = TRUE
      ORDER BY category, name
    `);

    res.json(rows.map(mapMenuItem));
  } catch (error) {
    next(error);
  }
});

router.get('/admin', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const { rows } = await query<MenuItemRow>(`
      SELECT id, name, category, price_cents, is_available
      FROM menu_items
      ORDER BY category, name
    `);

    res.json(rows.map(mapMenuItem));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = menuItemSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid menu item payload', issues: parsed.error.flatten() });
    return;
  }

  try {
    const { rows } = await query<MenuItemRow>(
      `
        INSERT INTO menu_items (name, category, price_cents, is_available)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, category, price_cents, is_available
      `,
      [parsed.data.name, parsed.data.category, parsed.data.priceCents, parsed.data.isAvailable]
    );

    res.status(201).json(mapMenuItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = updateMenuItemSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid menu item update payload', issues: parsed.error.flatten() });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ message: 'No updates provided' });
    return;
  }

  try {
    const { rows } = await query<MenuItemRow>(
      `
        UPDATE menu_items
        SET
          name = COALESCE($1, name),
          category = COALESCE($2, category),
          price_cents = COALESCE($3, price_cents),
          is_available = COALESCE($4, is_available)
        WHERE id = $5
        RETURNING id, name, category, price_cents, is_available
      `,
      [
        parsed.data.name ?? null,
        parsed.data.category ?? null,
        parsed.data.priceCents ?? null,
        parsed.data.isAvailable ?? null,
        req.params.id
      ]
    );

    if (!rows[0]) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    res.json(mapMenuItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

type MenuItemRow = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  is_available: boolean;
};

function mapMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.price_cents,
    isAvailable: row.is_available
  };
}

export default router;
