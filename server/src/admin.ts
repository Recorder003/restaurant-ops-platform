import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthenticatedRequest } from './authMiddleware.js';
import { query } from './db.js';
import { hashPassword } from './passwords.js';
import type { User, UserRole } from './types.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
  role: z.enum(['staff', 'admin', 'chef']).default('staff')
});

const updateStaffSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(['staff', 'admin', 'chef']).optional(),
  isActive: z.boolean().optional()
});

router.get('/staff', async (_req, res, next) => {
  try {
    const { rows } = await query<UserRow>(`
      SELECT id, name, email, role, is_active
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(rows.map(mapUser));
  } catch (error) {
    next(error);
  }
});

router.post('/staff', async (req, res, next) => {
  const parsed = createStaffSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid staff payload', issues: parsed.error.flatten() });
    return;
  }

  try {
    const { rows } = await query<UserRow>(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, role, is_active
      `,
      [
        parsed.data.name,
        parsed.data.email,
        await hashPassword(parsed.data.password),
        parsed.data.role
      ]
    );

    res.status(201).json(mapUser(rows[0]));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ message: 'A user with this email already exists' });
      return;
    }

    next(error);
  }
});

router.patch('/staff/:id', async (req, res, next) => {
  const parsed = updateStaffSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid staff update payload', issues: parsed.error.flatten() });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ message: 'No updates provided' });
    return;
  }

  try {
    const current = await query<{ id: string }>('SELECT id FROM users WHERE id = $1', [req.params.id]);

    if (current.rowCount === 0) {
      res.status(404).json({ message: 'Staff user not found' });
      return;
    }

    const { rows } = await query<UserRow>(
      `
        UPDATE users
        SET
          name = COALESCE($1, name),
          role = COALESCE($2, role),
          is_active = COALESCE($3, is_active)
        WHERE id = $4
        RETURNING id, name, email, role, is_active
      `,
      [
        parsed.data.name ?? null,
        parsed.data.role ?? null,
        parsed.data.isActive ?? null,
        req.params.id
      ]
    );

    res.json(mapUser(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete('/staff/:id', async (req, res, next) => {
  const currentUser = (req as unknown as AuthenticatedRequest).user;

  if (req.params.id === currentUser.id) {
    res.status(409).json({ message: 'You cannot delete your own account' });
    return;
  }

  try {
    const result = await query('DELETE FROM users WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Staff user not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active
  };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

export default router;
