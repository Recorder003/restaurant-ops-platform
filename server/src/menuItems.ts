import { Router } from 'express';
import { query } from './db.js';
import type { MenuItem } from './types.js';

const router = Router();

router.get('/', async (_req, res, next) => {
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
