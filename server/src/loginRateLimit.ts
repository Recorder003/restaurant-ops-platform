import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { getRedisClient } from './redisClient.js';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000);
const LOCKOUT_SECONDS = Math.ceil(LOCKOUT_MS / 1000);

type LoginAttempt = {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil?: number;
};

const attempts = new Map<string, LoginAttempt>();

export async function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getLoginKey(req);
  const redisKey = getRedisKey(key);

  try {
    const redis = await getRedisClient();

    if (redis) {
      const locked = await redis.get(`${redisKey}:locked`);

      if (locked) {
        res.status(429).json({
          message: 'Too many failed login attempts. Please try again later.'
        });
        return;
      }

      res.locals.loginRateLimitKey = key;
      next();
      return;
    }
  } catch {
    // Fall through to in-memory limiting when Redis is unavailable.
  }

  if (isMemoryLocked(key)) {
    res.status(429).json({
      message: 'Too many failed login attempts. Please try again later.'
    });
    return;
  }

  res.locals.loginRateLimitKey = key;
  next();
}

export async function recordFailedLogin(req: Request) {
  const key = getRequestLoginKey(req);
  const redisKey = getRedisKey(key);

  try {
    const redis = await getRedisClient();

    if (redis) {
      const failedCount = await redis.incr(`${redisKey}:failed`);

      if (failedCount === 1) {
        await redis.expire(`${redisKey}:failed`, WINDOW_SECONDS);
      }

      if (failedCount >= MAX_FAILED_ATTEMPTS) {
        await redis.set(`${redisKey}:locked`, '1', { EX: LOCKOUT_SECONDS });
      }

      return;
    }
  } catch {
    // Fall through to in-memory limiting when Redis is unavailable.
  }

  recordMemoryFailedLogin(key);
}

export async function recordSuccessfulLogin(req: Request) {
  const key = getRequestLoginKey(req);
  const redisKey = getRedisKey(key);

  try {
    const redis = await getRedisClient();

    if (redis) {
      await redis.del([`${redisKey}:failed`, `${redisKey}:locked`]);
      return;
    }
  } catch {
    // Fall through to in-memory limiting when Redis is unavailable.
  }

  attempts.delete(key);
}

function isMemoryLocked(key: string) {
  const attempt = attempts.get(key);
  const now = Date.now();

  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    return true;
  }

  if (attempt && now - attempt.firstFailedAt > WINDOW_MS) {
    attempts.delete(key);
  }

  return false;
}

function recordMemoryFailedLogin(key: string) {
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

function getRequestLoginKey(req: Request) {
  return typeof req.res?.locals.loginRateLimitKey === 'string'
    ? req.res.locals.loginRateLimitKey
    : getLoginKey(req);
}

function getLoginKey(req: Request) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown';
  return `${req.ip}:${email}`;
}

function getRedisKey(key: string) {
  return `${config.redisKeyPrefix}:login-rate-limit:${key}`;
}
