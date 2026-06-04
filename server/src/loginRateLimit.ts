import type { Request, Response, NextFunction } from 'express';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type LoginAttempt = {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil?: number;
};

const attempts = new Map<string, LoginAttempt>();

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getLoginKey(req);
  const attempt = attempts.get(key);
  const now = Date.now();

  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    res.status(429).json({
      message: 'Too many failed login attempts. Please try again later.'
    });
    return;
  }

  if (attempt && now - attempt.firstFailedAt > WINDOW_MS) {
    attempts.delete(key);
  }

  res.locals.loginRateLimitKey = key;
  next();
}

export function recordFailedLogin(req: Request) {
  const key = getRequestLoginKey(req);
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now - current.firstFailedAt > WINDOW_MS) {
    attempts.set(key, {
      failedCount: 1,
      firstFailedAt: now
    });
    return;
  }

  const failedCount = current.failedCount + 1;

  attempts.set(key, {
    failedCount,
    firstFailedAt: current.firstFailedAt,
    lockedUntil: failedCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : current.lockedUntil
  });
}

export function recordSuccessfulLogin(req: Request) {
  attempts.delete(getRequestLoginKey(req));
}

function getRequestLoginKey(req: Request) {
  return typeof req.res?.locals.loginRateLimitKey === 'string'
    ? req.res.locals.loginRateLimitKey
    : getLoginKey(req);
}

function getLoginKey(req: Request) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown';
  return `${req.ip}:${email}`;
}
