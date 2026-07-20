import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAuth, requireRole } from './authMiddleware.js';
import { config } from './config.js';
import { pool, query } from './db.js';
import { broadcastRealtimeEvent } from './realtime.js';
import { deleteCacheByPattern, getJsonCache, setJsonCache } from './redisClient.js';
import type { MenuBundle, MenuItem } from './types.js';

const router = Router();
const menuCategories = ['Entrees', 'Vegetables', 'Small Plates', 'Drinks', 'Desserts'] as const;
const alwaysAvailableMenuItems = new Set(['Lemon Iced Tea', 'Signature Beef Noodles']);
const menuCachePrefix = `${config.redisKeyPrefix}:menu`;
const menuCacheTtlSeconds = 60;

class MenuInputError extends Error {}

const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(menuCategories),
  priceCents: z.number().int().min(0).max(100000),
  isAvailable: z.boolean().default(true),
  isSoldOut: z.boolean().default(false)
});

const updateMenuItemSchema = menuItemSchema.partial();
const soldOutSchema = z.object({
  isSoldOut: z.boolean()
});
const menuBundleItemSchema = z.object({
  menuItemVariantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20)
});
const menuBundleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  priceCents: z.number().int().min(0).max(100000),
  isAvailable: z.boolean().default(true),
  isSoldOut: z.boolean().default(false),
  items: z.array(menuBundleItemSchema).min(1)
});
const updateMenuBundleSchema = menuBundleSchema.partial().refine((value) => value.items === undefined || value.items.length > 0, {
  message: 'Menu bundle must include at least one item',
  path: ['items']
});

router.get('/', async (_req, res, next) => {
  try {
    const menuItems = await getCachedMenuResponse<MenuItem[]>(`${menuCachePrefix}:public-items`, async () => {
      const { rows } = await query<MenuItemRow>(`
        ${menuItemSelectSql}
        WHERE mi.is_available = TRUE AND mi.is_sold_out = FALSE
        GROUP BY mi.id
        ORDER BY mi.category, mi.name
      `);

      return rows.map(mapMenuItem);
    });

    res.json(menuItems);
  } catch (error) {
    next(error);
  }
});

router.get('/admin', requireAuth, requireRole('admin', 'chef'), async (_req, res, next) => {
  try {
    const menuItems = await getCachedMenuResponse<MenuItem[]>(`${menuCachePrefix}:admin-items`, async () => {
      const { rows } = await query<MenuItemRow>(`
        ${menuItemSelectSql}
        GROUP BY mi.id
        ORDER BY mi.category, mi.name
      `);

      return rows.map(mapMenuItem);
    });

    res.json(menuItems);
  } catch (error) {
    next(error);
  }
});

router.get('/bundles', async (_req, res, next) => {
  try {
    const bundles = await getCachedMenuResponse<MenuBundle[]>(`${menuCachePrefix}:public-bundles`, async () => {
      const { rows } = await query<MenuBundleRow>(`
        ${menuBundleSelectSql}
        WHERE mb.is_available = TRUE AND mb.is_sold_out = FALSE
          AND NOT EXISTS (
            SELECT 1
            FROM menu_bundle_items component
            JOIN menu_item_variants component_variant ON component_variant.id = component.menu_item_variant_id
            JOIN menu_items component_item ON component_item.id = component_variant.menu_item_id
            WHERE component.bundle_id = mb.id
              AND (component_item.is_available = FALSE OR component_item.is_sold_out = TRUE)
          )
        GROUP BY mb.id
        ORDER BY mb.name
      `);

      return rows.map(mapMenuBundle);
    });

    res.json(bundles);
  } catch (error) {
    next(error);
  }
});

router.get('/bundles/admin', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const bundles = await getCachedMenuResponse<MenuBundle[]>(`${menuCachePrefix}:admin-bundles`, async () => {
      const { rows } = await query<MenuBundleRow>(`
        ${menuBundleSelectSql}
        GROUP BY mb.id
        ORDER BY mb.name
      `);

      return rows.map(mapMenuBundle);
    });

    res.json(bundles);
  } catch (error) {
    next(error);
  }
});

router.post('/bundles', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = menuBundleSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid menu bundle payload', issues: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await validateBundleItems(parsed.data.items.map((item) => item.menuItemVariantId));

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO menu_bundles (name, price_cents, is_available, is_sold_out)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [parsed.data.name, parsed.data.priceCents, parsed.data.isAvailable, parsed.data.isSoldOut]
    );

    await replaceBundleItems(client, rows[0].id, parsed.data.items);
    await client.query('COMMIT');

    const bundle = await getMenuBundleById(rows[0].id);
    await invalidateMenuCache();
    broadcastRealtimeEvent({ type: 'menu_changed', action: 'bundle_created', resourceId: bundle.id });
    res.status(201).json(bundle);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof MenuInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

router.patch('/bundles/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = updateMenuBundleSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid menu bundle update payload', issues: parsed.error.flatten() });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ message: 'No updates provided' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (parsed.data.items) {
      await validateBundleItems(parsed.data.items.map((item) => item.menuItemVariantId));
    }

    const { rows } = await client.query<{ id: string }>(
      `
        UPDATE menu_bundles
        SET
          name = COALESCE($1, name),
          price_cents = COALESCE($2, price_cents),
          is_available = COALESCE($3, is_available),
          is_sold_out = COALESCE($4, is_sold_out)
        WHERE id = $5
        RETURNING id
      `,
      [
        parsed.data.name ?? null,
        parsed.data.priceCents ?? null,
        parsed.data.isAvailable ?? null,
        parsed.data.isSoldOut ?? null,
        req.params.id
      ]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Menu bundle not found' });
      return;
    }

    if (parsed.data.items) {
      await replaceBundleItems(client, rows[0].id, parsed.data.items);
    }

    await client.query('COMMIT');

    const bundle = await getMenuBundleById(rows[0].id);
    await invalidateMenuCache();
    broadcastRealtimeEvent({ type: 'menu_changed', action: 'bundle_updated', resourceId: bundle.id });
    res.json(bundle);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof MenuInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

router.patch('/bundles/:id/sold-out', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = soldOutSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid sold out payload' });
    return;
  }

  try {
    const { rows } = await query<{ id: string }>(
      `
        UPDATE menu_bundles
        SET is_sold_out = $1
        WHERE id = $2
        RETURNING id
      `,
      [parsed.data.isSoldOut, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ message: 'Menu bundle not found' });
      return;
    }

    const bundle = await getMenuBundleById(rows[0].id);
    await invalidateMenuCache();
    broadcastRealtimeEvent({ type: 'menu_changed', action: 'bundle_sold_out_updated', resourceId: bundle.id });
    res.json(bundle);
  } catch (error) {
    next(error);
  }
});

router.delete('/bundles/:id', requireAuth, requireRole('staff', 'admin', 'chef'), async (req, res, next) => {
  try {
    const { rowCount } = await query('SELECT id FROM menu_bundles WHERE id = $1', [req.params.id]);

    if (rowCount === 0) {
      res.status(404).json({ message: 'Menu bundle not found' });
      return;
    }

    res.status(403).json({ message: 'Menu bundles cannot be deleted' });
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
    const { rows } = await query<{ id: string }>(
      `
        INSERT INTO menu_items (name, category, price_cents, is_available, is_sold_out)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [parsed.data.name, parsed.data.category, parsed.data.priceCents, parsed.data.isAvailable, parsed.data.isSoldOut]
    );

    await query(
      `
        INSERT INTO menu_item_variants (menu_item_id, name, price_cents, is_default)
        VALUES ($1, 'Regular', $2, TRUE)
      `,
      [rows[0].id, parsed.data.priceCents]
    );

    const menuItem = await getMenuItemById(rows[0].id);
    await invalidateMenuCache();
    broadcastRealtimeEvent({ type: 'menu_changed', action: 'created', resourceId: menuItem.id });
    res.status(201).json(menuItem);
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
    if (parsed.data.isAvailable === false || parsed.data.isSoldOut === true) {
      const current = await query<{ name: string }>('SELECT name FROM menu_items WHERE id = $1', [req.params.id]);

      if (current.rowCount === 0) {
        res.status(404).json({ message: 'Menu item not found' });
        return;
      }

      if (alwaysAvailableMenuItems.has(current.rows[0].name)) {
        res.status(403).json({ message: `${current.rows[0].name} must remain available` });
        return;
      }
    }

    const { rows } = await query<{ id: string }>(
      `
        UPDATE menu_items
        SET
          name = COALESCE($1, name),
          category = COALESCE($2, category),
          price_cents = COALESCE($3, price_cents),
          is_available = COALESCE($4, is_available),
          is_sold_out = COALESCE($5, is_sold_out)
        WHERE id = $6
        RETURNING id
      `,
      [
        parsed.data.name ?? null,
        parsed.data.category ?? null,
        parsed.data.priceCents ?? null,
        parsed.data.isAvailable ?? null,
        parsed.data.isSoldOut ?? null,
        req.params.id
      ]
    );

    if (!rows[0]) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    if (parsed.data.priceCents !== undefined) {
      await query(
        `
          UPDATE menu_item_variants
          SET price_cents = $1
          WHERE menu_item_id = $2 AND is_default = TRUE
        `,
        [parsed.data.priceCents, req.params.id]
      );
    }

    const menuItem = await getMenuItemById(rows[0].id);
    await invalidateMenuCache();
    broadcastRealtimeEvent({ type: 'menu_changed', action: 'updated', resourceId: menuItem.id });
    res.json(menuItem);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/sold-out', requireAuth, requireRole('admin', 'chef'), async (req, res, next) => {
  const parsed = soldOutSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid sold out payload' });
    return;
  }

  try {
    if (parsed.data.isSoldOut) {
      const current = await query<{ name: string }>('SELECT name FROM menu_items WHERE id = $1', [req.params.id]);

      if (current.rowCount === 0) {
        res.status(404).json({ message: 'Menu item not found' });
        return;
      }

      if (alwaysAvailableMenuItems.has(current.rows[0].name)) {
        res.status(403).json({ message: `${current.rows[0].name} cannot be marked sold out` });
        return;
      }
    }

    const { rows } = await query<{ id: string }>(
      `
        UPDATE menu_items
        SET is_sold_out = $1
        WHERE id = $2
        RETURNING id
      `,
      [parsed.data.isSoldOut, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    const menuItem = await getMenuItemById(rows[0].id);
    await invalidateMenuCache();
    broadcastRealtimeEvent({ type: 'menu_changed', action: 'sold_out_updated', resourceId: menuItem.id });
    res.json(menuItem);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, requireRole('staff', 'admin', 'chef'), async (req, res, next) => {
  try {
    const { rowCount } = await query('SELECT id FROM menu_items WHERE id = $1', [req.params.id]);

    if (rowCount === 0) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    res.status(403).json({ message: 'Menu items cannot be deleted' });
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
  is_sold_out: boolean;
  variants: Array<{
    id: string;
    menuItemId: string;
    name: string;
    priceCents: number;
    isDefault: boolean;
  }>;
};

type MenuBundleRow = {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
  is_sold_out: boolean;
  items: Array<{
    menuItemId: string;
    menuItemVariantId: string;
    menuItemName: string;
    variantName: string;
    category: string;
    quantity: number;
    priceCents: number;
    isAvailable: boolean;
    isSoldOut: boolean;
  }>;
};

const menuItemSelectSql = `
  SELECT
    mi.id,
    mi.name,
    mi.category,
    mi.price_cents,
    mi.is_available,
    mi.is_sold_out,
    COALESCE(
      json_agg(
        json_build_object(
          'id', miv.id,
          'menuItemId', miv.menu_item_id,
          'name', miv.name,
          'priceCents', miv.price_cents,
          'isDefault', miv.is_default
        )
        ORDER BY miv.is_default DESC, miv.price_cents ASC, miv.name ASC
      ) FILTER (WHERE miv.id IS NOT NULL),
      '[]'
    ) AS variants
  FROM menu_items mi
  LEFT JOIN menu_item_variants miv ON miv.menu_item_id = mi.id
`;

const menuBundleSelectSql = `
  SELECT
    mb.id,
    mb.name,
    mb.price_cents,
    mb.is_available,
    mb.is_sold_out,
    COALESCE(
      json_agg(
        json_build_object(
          'menuItemId', mi.id,
          'menuItemVariantId', miv.id,
          'menuItemName', mi.name,
          'variantName', miv.name,
          'category', mi.category,
          'quantity', mbi.quantity,
          'priceCents', miv.price_cents,
          'isAvailable', mi.is_available,
          'isSoldOut', mi.is_sold_out
        )
        ORDER BY mi.category, mi.name
      ) FILTER (WHERE mbi.bundle_id IS NOT NULL),
      '[]'
    ) AS items
  FROM menu_bundles mb
  LEFT JOIN menu_bundle_items mbi ON mbi.bundle_id = mb.id
  LEFT JOIN menu_item_variants miv ON miv.id = mbi.menu_item_variant_id
  LEFT JOIN menu_items mi ON mi.id = miv.menu_item_id
`;

async function getMenuItemById(id: string) {
  const { rows } = await query<MenuItemRow>(
    `
      ${menuItemSelectSql}
      WHERE mi.id = $1
      GROUP BY mi.id
    `,
    [id]
  );

  if (!rows[0]) {
    throw new Error(`Menu item ${id} not found after update`);
  }

  return mapMenuItem(rows[0]);
}

async function getMenuBundleById(id: string) {
  const { rows } = await query<MenuBundleRow>(
    `
      ${menuBundleSelectSql}
      WHERE mb.id = $1
      GROUP BY mb.id
    `,
    [id]
  );

  if (!rows[0]) {
    throw new Error(`Menu bundle ${id} not found after update`);
  }

  return mapMenuBundle(rows[0]);
}

async function validateBundleItems(menuItemVariantIds: string[]) {
  const uniqueIds = Array.from(new Set(menuItemVariantIds));
  const { rows } = await query<{ id: string }>(
    `
      SELECT miv.id
      FROM menu_item_variants miv
      JOIN menu_items mi ON mi.id = miv.menu_item_id
      WHERE miv.id = ANY($1::uuid[])
        AND mi.is_available = TRUE
        AND mi.is_sold_out = FALSE
    `,
    [uniqueIds]
  );

  if (rows.length !== uniqueIds.length) {
    throw new MenuInputError('Menu bundles can only use available, not sold-out menu items.');
  }
}

async function replaceBundleItems(
  client: PoolClient,
  bundleId: string,
  items: Array<{ menuItemVariantId: string; quantity: number }>
) {
  await client.query('DELETE FROM menu_bundle_items WHERE bundle_id = $1', [bundleId]);

  for (const item of items) {
    await client.query(
      `
        INSERT INTO menu_bundle_items (bundle_id, menu_item_variant_id, quantity)
        VALUES ($1, $2, $3)
      `,
      [bundleId, item.menuItemVariantId, item.quantity]
    );
  }
}

async function getCachedMenuResponse<T>(key: string, loadFresh: () => Promise<T>) {
  const cached = await getJsonCache<T>(key);

  if (cached) {
    return cached;
  }

  const fresh = await loadFresh();
  await setJsonCache(key, fresh, menuCacheTtlSeconds);
  return fresh;
}

async function invalidateMenuCache() {
  await deleteCacheByPattern(`${menuCachePrefix}:*`);
}

function mapMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.price_cents,
    isAvailable: row.is_available,
    isSoldOut: row.is_sold_out,
    variants: row.variants
  };
}

function mapMenuBundle(row: MenuBundleRow): MenuBundle {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    isAvailable: row.is_available,
    isSoldOut: row.is_sold_out,
    items: row.items
  };
}

export default router;
