/**
 * Integration test helper — provides real DB/Redis connections for testing.
 * Requires DATABASE_URL and REDIS_URL environment variables.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as menuSchema from '../../db/schemas/menu.js';
import * as orderSchema from '../../db/schemas/order.js';
import * as inventorySchema from '../../db/schemas/inventory.js';
import * as customerSchema from '../../db/schemas/customer.js';
import * as paymentSchema from '../../db/schemas/payment.js';
import * as automationSchema from '../../db/schemas/automation.js';
import * as feedbackSchema from '../../db/schemas/feedback.js';
import * as aiSchema from '../../db/schemas/ai.js';
import * as deliverySchema from '../../db/schemas/delivery.js';
import * as riderSchema from '../../db/schemas/rider.js';


const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL required for integration tests. Set it in .env or skip with: vitest run');
}

// ── Database ──
const queryClient = postgres(DATABASE_URL, { max: 5 });
export const db = drizzle(queryClient, {
  schema: {
    ...menuSchema,
    ...orderSchema,
    ...inventorySchema,
    ...customerSchema,
    ...paymentSchema,
    ...automationSchema,
    ...feedbackSchema,
    ...aiSchema,
    ...deliverySchema,
    ...riderSchema,
  },
});

// ── Redis (using ioredis for test isolation) ──
import Redis from 'ioredis';
export const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });

// ── Schema push (create tables if not exist) ──
export async function setupDatabase() {
  try {
    await queryClient`SELECT 1`;
    console.log('[Integration] Database connected');
  } catch (err: any) {
    throw new Error(`[Integration] Cannot connect to database: ${err.message}`);
  }
}

// ── Cleanup: delete all test data ──
export async function cleanupDatabase() {
  try {
    // Delete in correct order (respect FK constraints)
    await queryClient`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE 'TEST:%')`;
    await queryClient`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE 'TEST:%')`;
    await queryClient`DELETE FROM orders WHERE notes LIKE 'TEST:%'`;
    await queryClient`DELETE FROM customer_addresses WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@test.local')`;
    await queryClient`DELETE FROM customers WHERE email LIKE '%@test.local'`;
  } catch {
    // Tables may not exist yet — that's fine
  }
}

// ── Cleanup Redis test keys ──
export async function cleanupRedis() {
  try {
    const keys = await redis.keys('test:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis may not be available
  }
}

// ── Full teardown ──
export async function teardown() {
  await cleanupDatabase();
  await cleanupRedis();
  await queryClient.end({ timeout: 5 });
  redis.disconnect();
}
