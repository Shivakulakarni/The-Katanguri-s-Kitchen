import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as menuSchema from './schemas/menu.js';
import * as orderSchema from './schemas/order.js';
import * as inventorySchema from './schemas/inventory.js';
import * as customerSchema from './schemas/customer.js';
import * as paymentSchema from './schemas/payment.js';
import * as automationSchema from './schemas/automation.js';
import * as feedbackSchema from './schemas/feedback.js';
import * as aiSchema from './schemas/ai.js';
import * as deliverySchema from './schemas/delivery.js';
import * as riderSchema from './schemas/rider.js';
import { logger } from '../utils/logger.js';

const dbLogger = logger.child({ module: 'db' });

// Validate DATABASE_URL exists
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const queryClient = postgres(DATABASE_URL, {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'),
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10'),
  max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || '1800'),
  transform: {
    undefined: null,
  },
});

// Apply session timeouts on first connection (persistent per-connection requires ALTER DATABASE)
queryClient`SET statement_timeout = '30s'`.catch(() => {});
queryClient`SET lock_timeout = '10s'`.catch(() => {});

// Verify connectivity on startup (non-blocking)
checkDatabaseHealth().then((ok) => {
  if (ok) dbLogger.info('[DB] Connection pool established');
  else dbLogger.warn('[DB] Initial health check failed — will retry via pool');
});

// Run startup migrations for tables that may not exist yet
runStartupMigrations().catch((err) => {
  dbLogger.error({ err: err.message }, '[DB] Startup migration failed');
});

async function runStartupMigrations() {
  try {
    await queryClient`
      CREATE TABLE IF NOT EXISTS "customer_favorites" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "customer_id" integer NOT NULL REFERENCES "customers"("id"),
        "dish_id" integer NOT NULL REFERENCES "dishes"("id"),
        "created_at" timestamp DEFAULT now()
      )
    `;
    await queryClient`CREATE INDEX IF NOT EXISTS "idx_customer_favorites_customer" ON "customer_favorites" USING btree ("customer_id")`;
    await queryClient`CREATE INDEX IF NOT EXISTS "idx_customer_favorites_customer_dish" ON "customer_favorites" USING btree ("customer_id","dish_id")`;
    await queryClient`CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_favorites_unique" ON "customer_favorites" USING btree ("customer_id","dish_id")`;
    dbLogger.info('[DB] Startup migration: customer_favorites table ready');
  } catch (err: any) {
    dbLogger.error({ err: err.message }, '[DB] customer_favorites migration failed');
  }

  try {
    await queryClient`
      CREATE TABLE IF NOT EXISTS "feedback_analysis" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "feedback_id" integer NOT NULL,
        "sentiment" text NOT NULL,
        "score" text NOT NULL,
        "themes" jsonb,
        "summary" text,
        "suggested_action" text,
        "analyzed_at" timestamp DEFAULT now()
      )
    `;
    dbLogger.info('[DB] Startup migration: feedback_analysis table ready');
  } catch (err: any) {
    dbLogger.error({ err: err.message }, '[DB] feedback_analysis migration failed');
  }
}

const pool = queryClient;
export { pool as queryClient };

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

/**
 * Health check for database connectivity.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully close the database connection pool.
 */
export async function closeDatabase(): Promise<void> {
  try {
    await queryClient.end({ timeout: 5 });
    dbLogger.info('[DB] Connection pool closed');
  } catch (err: any) {
    dbLogger.error({ err: err.message }, '[DB] Error closing connection pool');
  }
}
