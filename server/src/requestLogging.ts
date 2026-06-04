import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const incomingRequestId = req.get('x-request-id');
  const requestId = incomingRequestId && incomingRequestId.length <= 100
    ? incomingRequestId
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function logRequest(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.method === 'OPTIONS' || res.statusCode === 304) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.log(JSON.stringify({
      level: 'info',
      message: 'request_completed',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userAgent: req.get('user-agent') ?? null
    }));
  });

  next();
}

export function logError(message: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error(JSON.stringify({
    level: 'error',
    message,
    ...details,
    error: normalizeError(error)
  }));
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
}
