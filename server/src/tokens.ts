import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import type { UserRole } from './types.js';

const tokenTtlSeconds = 60 * 60 * 8;

type TokenPayload = {
  sub: string;
  role: UserRole;
  exp: number;
};

export function createAccessToken(input: { userId: string; role: UserRole }) {
  const payload: TokenPayload = {
    sub: input.userId,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string): TokenPayload | null {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;

    if (!payload.sub || !payload.role || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac('sha256', config.authTokenSecret).update(value).digest('base64url');
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
