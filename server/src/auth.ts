import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from './authMiddleware.js';
import { query } from './db.js';
import { loginRateLimit, recordFailedLogin, recordSuccessfulLogin } from './loginRateLimit.js';
import { verifyPassword } from './passwords.js';
import { createAccessToken } from './tokens.js';
import type { User, UserRole } from './types.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200)
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid login payload' });
    return;
  }

  try {
    const { rows } = await query<UserRow>(
      'SELECT id, name, email, role, is_active, password_hash FROM users WHERE email = $1',
      [parsed.data.email]
    );
    const user = rows[0];

    if (!user || !user.is_active || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      recordFailedLogin(req);
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    recordSuccessfulLogin(req);
    const safeUser = mapUser(user);

    res.json({
      accessToken: createAccessToken({ userId: safeUser.id, role: safeUser.role }),
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json((req as AuthenticatedRequest).user);
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  password_hash: string;
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

export default router;
