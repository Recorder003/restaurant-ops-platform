import { Router } from 'express';
import { z } from 'zod';
import { query } from './db.js';

const router = Router();

const visitorSchema = z.object({
  deviceId: z.string().trim().min(12).max(120)
});

router.post('/', async (req, res, next) => {
  try {
    const input = visitorSchema.parse(req.body);

    await query(
      `
        INSERT INTO demo_visitors (device_id)
        VALUES ($1)
        ON CONFLICT (device_id) DO UPDATE SET
          last_seen_at = NOW(),
          visit_count = demo_visitors.visit_count + 1
      `,
      [input.deviceId]
    );

    const { rows } = await query<{ visitor_count: string }>('SELECT COUNT(*) AS visitor_count FROM demo_visitors');

    res.json({ visitorCount: Number(rows[0]?.visitor_count ?? 0) });
  } catch (error) {
    next(error);
  }
});

export default router;
