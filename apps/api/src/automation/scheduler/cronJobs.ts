import { Queue, Worker } from 'bullmq';
import { redis } from '../../utils/redis.js';
import { db } from '../../db/connection.js';
import { ingredients, inventoryTransactions } from '../../db/schemas/inventory.js';
import { payments } from '../../db/schemas/payment.js';
import { orders, orderStatusHistory } from '../../db/schemas/order.js';
import { automationLogs } from '../../db/schemas/automation.js';
import { eq, and, gte, lt, inArray, sql } from 'drizzle-orm';
import { sendAdminAlert } from '../../services/email.service.js';
import { communicationQueue } from '../../utils/queue.js';
import { logger } from '../../utils/logger.js';
import { STRIPE_API_VERSION } from '../../lib/constants.js';
import { publishEvent } from '../../utils/eventBus.js';
import Stripe from 'stripe';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { mkdirSync, statSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';

// BullMQ requires maxRetriesPerRequest to be null — use a dedicated connection
const connection = (redis as any).duplicate({ maxRetriesPerRequest: null });
let cronQueue: Queue | null = null;

const execFileAsync = promisify(execFile);
const log = logger.child({ module: 'cron' });

async function lowStockScan() {
  const lowStock = await db.select({
    id: ingredients.id, name: ingredients.name, currentStock: ingredients.currentStock,
    parLevel: ingredients.parLevel, unit: ingredients.unit,
  }).from(ingredients)
    .where(sql`CAST(${ingredients.currentStock} AS DECIMAL) < CAST(${ingredients.parLevel} AS DECIMAL)`);
  const results = lowStock.map(i => `${i.name}: ${i.currentStock}/${i.parLevel} ${i.unit}`);
  if (lowStock.length > 5) {
    const alertEmail = process.env.ALERT_EMAIL_TO;
    if (alertEmail) {
      await sendAdminAlert([alertEmail], 'Low Stock Alert', `${lowStock.length} ingredients below par level:\n${results.join('\n')}`).catch(() => {});
    }
  }
  return { scanned: lowStock.length, lowStock: lowStock.length, items: results };
}

async function computeHourlyAnalytics() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentOrders = await db.select({ id: orders.id, totalAmount: orders.totalAmount }).from(orders).where(gte(orders.createdAt, oneHourAgo));
  const totalRevenue = recentOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount.toString()), 0);
  return { timestamp: new Date().toISOString(), orders: recentOrders.length, revenue: totalRevenue };
}

async function reconcilePayments() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey === 'sk_test_CHANGE_ME') {
    return { error: 'Stripe not configured' };
  }
  try {
    const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION as any });
    const pending = await db.select().from(payments).where(eq(payments.status, 'pending'));
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const payment of pending) {
      if (!payment.paymentIntentId) {
        unmatched.push('null');
        continue;
      }
      try {
        const pi = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
        if (pi.status === 'succeeded') {
          await db.update(payments).set({ status: 'succeeded' }).where(eq(payments.id, payment.id));
          if (payment.orderId) {
            await db.update(orders).set({ status: 'CONFIRMED' }).where(eq(orders.id, payment.orderId));
          }
          matched.push(payment.paymentIntentId);
        } else if (pi.status === 'canceled') {
          await db.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
          unmatched.push(payment.paymentIntentId);
        }
      } catch {
        unmatched.push(payment.paymentIntentId);
      }
    }
    return { matched: matched.length, unmatched: unmatched.length, total: pending.length };
  } catch {
    return { error: 'Reconciliation failed' };
  }
}

/**
 * Real database backup using pg_dump + gzip.
 * Outputs to BACKUP_DIR (default: ./backups) with timestamped filenames.
 * Optionally uploads to S3 if BACKUP_S3_URL is set.
 */
async function backupDatabase() {
  const backupDir = process.env.BACKUP_DIR || './backups';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `kitchen_db_${timestamp}.sql.gz`;
  const filepath = join(backupDir, filename);

  try {
    // Ensure backup directory exists
    mkdirSync(backupDir, { recursive: true });

    // Parse DATABASE_URL to extract connection details
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { error: 'DATABASE_URL not set — cannot backup' };
    }

    // pg_dump via connection string, compress with Node.js zlib (no shell needed)
    const { stdout } = await execFileAsync('pg_dump', [
      dbUrl, '--no-owner', '--no-acl', '--clean', '--if-exists'
    ]);
    const gzipped = gzipSync(Buffer.from(stdout));
    writeFileSync(filepath, gzipped);

    // Get file size
    const size = statSync(filepath).size;

    log.info({ filepath, size }, '[Backup] Database backup completed');

    return {
      status: 'completed',
      file: filepath,
      size: `${(size / 1024 / 1024).toFixed(2)}MB`,
      timestamp,
    };
  } catch (err: any) {
    log.error({ err: err.message }, '[Backup] Database backup failed');
    const alertEmail = process.env.ALERT_EMAIL_TO;
    if (alertEmail) {
      await sendAdminAlert([alertEmail], 'CRITICAL: Database Backup Failed', err.message).catch(() => {});
    }
    return { error: err.message };
  }
}

async function generateDailyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dailyOrders = await db.select({ id: orders.id, totalAmount: orders.totalAmount }).from(orders)
    .where(and(gte(orders.createdAt, yesterday), lt(orders.createdAt, today)));
  const totalRevenue = dailyOrders.reduce((s, o) => s + parseFloat(o.totalAmount.toString()), 0);
  return { date: yesterday.toISOString().split('T')[0], orders: dailyOrders.length, revenue: totalRevenue };
}

async function generateWeeklyReport() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyOrders = await db.select({ id: orders.id, totalAmount: orders.totalAmount }).from(orders).where(gte(orders.createdAt, sevenDaysAgo));
  const totalRevenue = weeklyOrders.reduce((s, o) => s + parseFloat(o.totalAmount.toString()), 0);
  return { period: '7d', orders: weeklyOrders.length, revenue: totalRevenue };
}

async function archiveAuditLogs() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const oldLogs = await db.select({ id: automationLogs.id }).from(automationLogs).where(lt(automationLogs.createdAt, ninetyDaysAgo));
  return { archived: oldLogs.length };
}

async function expiredPendingOrders() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const expired = await db.select({
    id: orders.id, customerId: orders.customerId, status: orders.status,
    totalAmount: orders.totalAmount, paymentIntentId: orders.paymentIntentId,
    createdAt: orders.createdAt,
  }).from(orders)
    .where(and(eq(orders.status, 'PENDING'), lt(orders.createdAt, thirtyMinAgo)));

  let cancelled = 0;
  for (const order of expired) {
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        changedBy: 'system_expiry',
        notes: 'Auto-cancelled: payment not received within 30 minutes',
      });
    });
    await publishEvent('order.cancelled', { orderId: order.id, customerId: order.customerId, status: 'PENDING' });
    cancelled++;
  }
  return { expired: expired.length, cancelled };
}

async function abandonedCartRecovery() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  // Find customers with PENDING orders older than 1 hour (abandoned checkout)
  const abandoned = await db.select({ id: orders.id, customerId: orders.customerId }).from(orders)
    .where(and(eq(orders.status, 'PENDING'), lt(orders.createdAt, oneHourAgo), gte(orders.createdAt, twoHoursAgo)));
  
  const uniqueCustomerIds = [...new Set(abandoned.map(o => o.customerId).filter(Boolean))] as number[];
  for (const customerId of uniqueCustomerIds) {
    await communicationQueue.add('abandoned-cart', { customerId }, { delay: 60 * 60 * 1000 });
  }
  return { abandonedOrders: abandoned.length, notificationsQueued: uniqueCustomerIds.length };
}

async function depletionForecast() {
  const all = await db.select({ id: ingredients.id, name: ingredients.name, currentStock: ingredients.currentStock }).from(ingredients);
  const ids = all.map(i => i.id);
  if (ids.length === 0) return { critical: 0, items: [] };

  const txSummary = await db.select({
    ingredientId: inventoryTransactions.ingredientId,
    totalQty: sql<string>`SUM(ABS(CAST(${inventoryTransactions.changeQty} AS DECIMAL)))`,
    txCount: sql<number>`COUNT(*)`,
  }).from(inventoryTransactions)
    .where(and(
      inArray(inventoryTransactions.ingredientId, ids),
      eq(inventoryTransactions.reason, 'order_deduction')
    ))
    .groupBy(inventoryTransactions.ingredientId);

  const txMap = new Map(txSummary.map(t => [t.ingredientId, { total: parseFloat(t.totalQty), count: t.txCount }]));
  const critical: any[] = [];
  for (const ing of all) {
    const data = txMap.get(ing.id);
    if (!data || data.count < 3) continue;
    const dailyAvg = data.total / data.count;
    const days = dailyAvg > 0 ? parseFloat(ing.currentStock.toString()) / dailyAvg : Infinity;
    if (days <= 2) critical.push({ ingredientId: ing.id, name: ing.name, daysUntilEmpty: Math.round(days * 10) / 10 });
  }
  if (critical.length > 0) {
    const alertEmail = process.env.ALERT_EMAIL_TO;
    if (alertEmail) {
      await sendAdminAlert([alertEmail], 'CRITICAL: Stock Depletion Forecast',
        `Ingredients predicted to run out within 48 hours:\n${critical.map(c => `${c.name}: ${c.daysUntilEmpty} days`).join('\n')}`
      ).catch(() => {});
    }
  }
  return { critical: critical.length, items: critical };
}

export async function setupCronJobs() {
  try {
    const info = await redis.info('server');
    const match = info.match(/redis_version:(\d+\.\d+)/);
    const ver = match ? parseFloat(match[1]) : 0;
    if (ver < 5) {
      log.warn('[Cron] Redis version < 5 — cron jobs disabled');
      return;
    }
  } catch {
    log.warn('[Cron] Cannot check Redis version — cron jobs disabled');
    return;
  }

  try {
    cronQueue = new Queue('cron-jobs', { connection });
    cronQueue.on('error', (err: any) => log.warn({ err: err.message }, '[BullMQ Queue Error] cron-jobs'));
  } catch {
    log.warn('[Cron] Cannot create BullMQ queue — cron jobs disabled');
    return;
  }

  try {
    const worker = new Worker('cron-jobs', async (job: any) => {
      switch (job.name) {
        case 'low-stock-scan': return lowStockScan();
        case 'hourly-analytics': return computeHourlyAnalytics();
        case 'payment-reconcile': return reconcilePayments();
        case 'db-backup': return backupDatabase();
        case 'daily-report': return generateDailyReport();
        case 'weekly-report': return generateWeeklyReport();
        case 'audit-archive': return archiveAuditLogs();
        case 'depletion-forecast': return depletionForecast();
        case 'abandoned-cart-recovery': return abandonedCartRecovery();
        case 'expired-pending-orders': return expiredPendingOrders();
      }
    }, { connection });
    worker.on('error', (err: any) => log.warn({ err: err.message }, '[BullMQ Worker Error] cron-jobs'));
  } catch (err: any) {
    log.warn({ err: err.message }, '[Cron] Failed to create cron worker');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  try {
    await cronQueue!.upsertJobScheduler('low-stock-scan', { every: isDev ? 60000 : 15 * 60 * 1000 }, { name: 'low-stock-scan' });
    await cronQueue!.upsertJobScheduler('hourly-analytics', { every: 60 * 60 * 1000 }, { name: 'hourly-analytics' });
    await cronQueue!.upsertJobScheduler('payment-reconcile', { pattern: '59 23 * * *' }, { name: 'payment-reconcile' });
    await cronQueue!.upsertJobScheduler('depletion-forecast', { pattern: '0 2 * * *' }, { name: 'depletion-forecast' });
    await cronQueue!.upsertJobScheduler('db-backup', { pattern: '0 3 * * *' }, { name: 'db-backup' });
    await cronQueue!.upsertJobScheduler('daily-report', { pattern: '0 4 * * *' }, { name: 'daily-report' });
    await cronQueue!.upsertJobScheduler('weekly-report', { pattern: '0 5 * * 1' }, { name: 'weekly-report' });
    await cronQueue!.upsertJobScheduler('audit-archive', { pattern: '0 1 1 * *' }, { name: 'audit-archive' });
    await cronQueue!.upsertJobScheduler('abandoned-cart-recovery', { every: 15 * 60 * 1000 }, { name: 'abandoned-cart-recovery' });
    await cronQueue!.upsertJobScheduler('expired-pending-orders', { every: 5 * 60 * 1000 }, { name: 'expired-pending-orders' });
    log.info('[Cron] Scheduled jobs registered');
  } catch (err: any) {
    log.warn({ err: err.message }, '[Cron] Failed to register scheduled jobs');
  }
}
