import { createClient, type RedisClientType } from 'redis';
import { config } from './config.js';

let client: RedisClientType | null = null;
let connectionAttempt: Promise<RedisClientType | null> | null = null;
let disabled = false;

export async function getRedisClient() {
  if (!config.redisUrl || disabled) {
    return null;
  }

  if (client?.isOpen) {
    return client;
  }

  if (!connectionAttempt) {
    connectionAttempt = connectRedis();
  }

  return connectionAttempt;
}

export async function pingRedis() {
  if (!config.redisUrl) {
    return 'disabled' as const;
  }

  try {
    const redis = await getRedisClient();

    if (!redis) {
      return 'unavailable' as const;
    }

    await redis.ping();
    return 'connected' as const;
  } catch {
    return 'unavailable' as const;
  }
}

export async function closeRedisClient() {
  if (client?.isOpen) {
    await client.quit();
  }
}

export async function getJsonCache<T>(key: string) {
  const redis = await getRedisClient();

  if (!redis) {
    return null;
  }

  const value = await redis.get(key);

  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

export async function setJsonCache(key: string, value: unknown, ttlSeconds: number) {
  const redis = await getRedisClient();

  if (!redis) {
    return;
  }

  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function deleteCacheByPattern(pattern: string) {
  const redis = await getRedisClient();

  if (!redis) {
    return;
  }

  const keys: string[] = [];

  for await (const keyOrKeys of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    if (Array.isArray(keyOrKeys)) {
      keys.push(...keyOrKeys.map(String));
    } else {
      keys.push(String(keyOrKeys));
    }
  }

  if (keys.length > 0) {
    await redis.del(keys);
  }
}

async function connectRedis() {
  const nextClient = createClient({ url: config.redisUrl });

  nextClient.on('error', () => {
    disabled = true;
  });

  try {
    await nextClient.connect();
    client = nextClient as RedisClientType;
    disabled = false;
    return client;
  } catch {
    disabled = true;
    return null;
  } finally {
    connectionAttempt = null;
  }
}
