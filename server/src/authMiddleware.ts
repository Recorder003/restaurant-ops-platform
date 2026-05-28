import type { NextFunction, Request, Response } from 'express';
import { query } from './db.js';
import { verifyAccessToken } from './tokens.js';
import type { User, UserRole } from './types.js';

export type AuthenticatedRequest = Request & {
  user: User;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ message: 'Invalid or expired session' });
    return;
  }

  try {
    const { rows } = await query<UserRow>(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );

    if (!rows[0] || !rows[0].is_active) {
      res.status(401).json({ message: 'Invalid or expired session' });
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      isActive: rows[0].is_active
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Partial<AuthenticatedRequest>).user;

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: 'You do not have permission to access this resource' });
      return;
    }

    next();
  };
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};
