import { Redis, RedisOptions } from 'ioredis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTls = REDIS_URL.startsWith('rediss://');

function createRedis(name: string): Redis {
  const opts: RedisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 20) return null;
      return Math.min(times * 200, 5000);
    },
    enableReadyCheck: true,
    lazyConnect: true,
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  };

  if (isTls) {
    opts.tls = {};
  }

  const client = new Redis(REDIS_URL, opts);

  client.on('error', (err: any) => {
    logger.error({ err: err.message }, `[Redis:${name}] Connection error`);
  });

  client.on('connect', () => {
    logger.info(`[Redis:${name}] Connected`);
  });

  client.on('reconnecting', () => {
    logger.warn(`[Redis:${name}] Reconnecting...`);
  });

  client.connect().catch((err: any) => {
    logger.error({ err: err.message }, `[Redis:${name}] Initial connection failed, will retry`);
  });

  return client;
}

export const redis = createRedis('main');
export const pubSub = createRedis('pubsub');
export const subscriberRedis = createRedis('subscriber');

export async function verifyRedisConnection(): Promise<void> {
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('Unexpected ping response');
  } catch (err: any) {
    logger.error({ err: err.message }, '[Redis] Startup connectivity check failed');
    throw err;
  }
}
