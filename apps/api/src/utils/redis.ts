import { Redis } from 'ioredis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => times > 3 ? null : Math.min(times * 100, 1000),
  enableReadyCheck: false,
  lazyConnect: true,
});

export const pubSub = new Redis(REDIS_URL, { lazyConnect: true });
export const subscriberRedis = new Redis(REDIS_URL, { lazyConnect: true, enableReadyCheck: false });

redis.connect().catch((err: any) => logger.error({ err: err.message }, '[Redis] Main connection failed'));
pubSub.connect().catch((err: any) => logger.error({ err: err.message }, '[Redis] PubSub connection failed'));
subscriberRedis.connect().catch((err: any) => logger.error({ err: err.message }, '[Redis] Subscriber connection failed'));

export async function verifyRedisConnection(): Promise<void> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('Unexpected ping response');
  } catch (err: any) {
    logger.error({ err: err.message }, '[Redis] Startup connectivity check failed');
    throw err;
  }
}


