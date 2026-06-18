import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { incomingOrders, webhookEndpoints, webhookDeliveries, webhookAlerts } from '../../db/schemas/delivery.js';
import { orders, orderItems, orderStatusHistory } from '../../db/schemas/order.js';
import { eq, and, gte, sql, desc, count, inArray, ilike } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { publishEvent } from '../../utils/eventBus.js';
import { sendWebhookAlertNotification } from './notifications.js';
import { verifyWebhookSignature, getSignatureHeader, normalizeOrderPayload } from './webhook-utils.js';
import { redis } from '../../utils/redis.js';
import { isSafeUrl } from '../../lib/validation.js';

const ALERT_LOG_KEY = 'webhook:alertLogs';
const ALERT_LOG_MAX = 100;

type AlertLog = { id: number; source: string; errorRate: number; failedCount: number; totalCount: number; message: string; createdAt: string };

async function pushAlertLog(entry: Omit<AlertLog, 'id'>): Promise<void> {
  try {
    // Use a Redis transaction to avoid race conditions
    const pipeline = redis.pipeline();
    pipeline.lrange(ALERT_LOG_KEY, 0, -1);
    const results = await pipeline.exec();
    const raw = results?.[0]?.[1] as string[] || [];
    const logs: AlertLog[] = raw.map(r => JSON.parse(r));
    const newId = logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;
    logs.unshift({ ...entry, id: newId });
    if (logs.length > ALERT_LOG_MAX) logs.length = ALERT_LOG_MAX;
    
    // Atomic replace
    const deletePipeline = redis.pipeline();
    deletePipeline.del(ALERT_LOG_KEY);
    if (logs.length > 0) {
      deletePipeline.lpush(ALERT_LOG_KEY, ...logs.map(l => JSON.stringify(l)));
    }
    await deletePipeline.exec();
  } catch {
    // Redis unavailable — silently drop log entry
  }
}

async function getAlertLogs(): Promise<AlertLog[]> {
  try {
    const raw = await redis.lrange(ALERT_LOG_KEY, 0, -1);
    return raw.map(r => JSON.parse(r));
  } catch {
    return [];
  }
}

/**
 * Webhook endpoint for receiving orders from aggregator platforms.
 * Supports Swiggy, Zomato, and generic middleware (UrbanPiper, Posist, Petpooja).
 *
 * POST /api/v1/webhooks/orders/:source
 * Source: swiggy | zomato | urbanpiper | posist | generic
 */
export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/v1/webhooks/orders/:source', { config: { rawBody: true } }, async (request, reply) => {
    const { source } = request.params as { source: string };
    const payload = request.body as any;

    // Validate source
    const validSources = ['swiggy', 'zomato', 'urbanpiper', 'posist', 'generic'];
    if (!validSources.includes(source)) {
      return reply.status(400).send({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
    }

    // Use raw body for HMAC signature verification (Fastify rawBody preserves original bytes)
    const rawBody = (request as any).rawBody || JSON.stringify(payload);

    // Verify HMAC signature — mandatory if WEBHOOK_SECRET is configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = getSignatureHeader(source, request.headers);
      if (!verifyWebhookSignature(source, rawBody, signature, webhookSecret)) {
        return reply.status(401).send({ error: 'Invalid webhook signature' });
      }
    } else {
      return reply.status(501).send({ error: 'Webhook secret not configured — cannot verify incoming orders' });
    }

    // Extract order details based on source format
    const orderData = normalizeOrderPayload(source, payload);

    // Validate order has items — reject empty/malformed payloads
    if (!orderData.items || orderData.items.length === 0) {
      return reply.status(400).send({ error: 'Order has no items — rejected as invalid payload' });
    }

    // Distributed lock to prevent race condition on duplicate externalId
    const lockKey = `webhook:idempotency:${source}:${orderData.externalId}`;
    const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX').catch(() => null);
    if (!lockAcquired) {
      return { success: true, message: 'Duplicate order ignored (concurrent processing)' };
    }

    try {
      // Check for existing order BEFORE inserting (true idempotency check)
      const existingOrders = await db.select().from(incomingOrders)
        .where(and(eq(incomingOrders.externalId, orderData.externalId), eq(incomingOrders.source, source)));

      if (existingOrders.length > 0) {
        const existing = existingOrders[0];
        if (existing.status === 'failed') {
          // Allow retry of failed orders — reprocess the existing record
        } else {
          return { success: true, message: 'Duplicate order ignored', existingInternalId: existing.internalOrderId };
        }
      }

      // Store incoming order (or reuse failed record for retry)
      const isRetry = existingOrders.length > 0 && existingOrders[0].status === 'failed';
      const stored = isRetry ? existingOrders[0] : (await db.insert(incomingOrders).values({
        externalId: orderData.externalId,
        source,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        customerAddress: orderData.customerAddress,
        payload,
        status: 'received',
      }).returning())[0];

      if (isRetry) {
        await db.update(incomingOrders)
          .set({ status: 'received', errorMessage: null, payload, processedAt: null })
          .where(eq(incomingOrders.id, stored.id));
      }

      // Auto-create internal order
      const totalAmount = orderData.items.reduce(
        (sum: number, item: any) => sum + item.unitPrice * item.quantity, 0
      );

      const order = await db.transaction(async (tx) => {
        const [o] = await tx.insert(orders).values({
          status: 'CONFIRMED',
          totalAmount: totalAmount.toString(),
          notes: `[${source}] ${orderData.customerAddress || ''}`,
          paymentIntentId: null,
        }).returning();

        for (const item of orderData.items) {
          await tx.insert(orderItems).values({
            orderId: o.id,
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            modifiers: item.modifiers || [],
          });
        }

        await tx.insert(orderStatusHistory).values({
          orderId: o.id,
          toStatus: 'CONFIRMED',
          changedBy: `webhook:${source}`,
        });

        await tx.update(incomingOrders)
          .set({ internalOrderId: o.id, status: 'created', processedAt: new Date() })
          .where(eq(incomingOrders.id, stored.id));

        return o;
      });

      await publishEvent('order.placed', {
        orderId: order.id,
        source,
        externalId: orderData.externalId,
        totalAmount,
      });

      return { success: true, orderId: order.id, message: 'Order created successfully' };
    } catch {
      return reply.status(500).send({ error: 'Failed to create order' });
    } finally {
      redis.del(lockKey).catch(() => {});
    }
  });

  // Admin: view incoming orders (with pagination support)
  app.get('/api/v1/admin/incoming-orders', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { limit = '100', offset = '0' } = request.query as { limit?: string; offset?: string };
    const orders = await db.select().from(incomingOrders)
      .orderBy(incomingOrders.createdAt)
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    const totalResult = await db.select({ count: count() }).from(incomingOrders);
    return { orders, total: totalResult[0]?.count ?? 0 };
  });

  // Admin: delete incoming order
  app.delete('/api/v1/admin/incoming-orders/:id', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    await db.delete(incomingOrders).where(eq(incomingOrders.id, parseInt(id)));
    return { success: true };
  });

  // Admin: get status history for an incoming order's linked internal order
  app.get('/api/v1/admin/incoming-orders/:id/history', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    const [incoming] = await db.select().from(incomingOrders).where(eq(incomingOrders.id, parseInt(id)));
    if (!incoming) return { error: 'Incoming order not found' };

    // Get incoming order status transitions (we track them in the payload)
    const incomingHistory = [
      { status: 'received', timestamp: incoming.createdAt, changedBy: 'webhook' },
      ...(incoming.processedAt ? [{ status: incoming.status, timestamp: incoming.processedAt, changedBy: 'webhook:auto' }] : []),
    ];

    // If linked to internal order, get its full status history
    let internalHistory: any[] = [];
    if (incoming.internalOrderId) {
      internalHistory = await db.select().from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, incoming.internalOrderId))
        .orderBy(orderStatusHistory.createdAt);
    }

    return {
      incoming: { externalId: incoming.externalId, source: incoming.source, status: incoming.status, errorMessage: incoming.errorMessage },
      incomingHistory,
      internalOrderId: incoming.internalOrderId,
      internalHistory: internalHistory.map(h => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: h.changedBy,
        timestamp: h.createdAt,
      })),
    };
  });

  // Admin: webhook analytics — volume by source over last N days
  app.get('/api/v1/admin/webhooks/analytics', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { days = '7' } = request.query as { days?: string };
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Total counts by status
    const statusCounts = await db.select({
      status: incomingOrders.status,
      count: count(),
    }).from(incomingOrders)
      .where(gte(incomingOrders.createdAt, since))
      .groupBy(incomingOrders.status);

    // Counts by source
    const sourceCounts = await db.select({
      source: incomingOrders.source,
      count: count(),
    }).from(incomingOrders)
      .where(gte(incomingOrders.createdAt, since))
      .groupBy(incomingOrders.source);

    // Daily volume by source (last N days)
    const dailyBySource = await db.select({
      date: sql<string>`DATE(${incomingOrders.createdAt})`.as('date'),
      source: incomingOrders.source,
      count: count(),
    }).from(incomingOrders)
      .where(gte(incomingOrders.createdAt, since))
      .groupBy(sql`DATE(${incomingOrders.createdAt})`, incomingOrders.source)
      .orderBy(sql`DATE(${incomingOrders.createdAt})`);

    // Average processing time (received -> created)
    const avgProcessingTime = await db.select({
      avgSeconds: sql<number>`AVG(EXTRACT(EPOCH FROM (${incomingOrders.processedAt} AT TIME ZONE 'UTC' - ${incomingOrders.createdAt} AT TIME ZONE 'UTC')))`.as('avg_seconds'),
    }).from(incomingOrders)
      .where(and(
        gte(incomingOrders.createdAt, since),
        eq(incomingOrders.status, 'created'),
      ));

    // Error rate
    const totalOrders = await db.select({ count: count() }).from(incomingOrders)
      .where(gte(incomingOrders.createdAt, since));
    const failedOrders = await db.select({ count: count() }).from(incomingOrders)
      .where(and(gte(incomingOrders.createdAt, since), eq(incomingOrders.status, 'failed')));

    return {
      days: parseInt(days),
      statusCounts: statusCounts.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {} as Record<string, number>),
      sourceCounts: sourceCounts.reduce((acc, r) => { acc[r.source] = r.count; return acc; }, {} as Record<string, number>),
      dailyBySource,
      avgProcessingTimeSeconds: avgProcessingTime[0]?.avgSeconds || 0,
      errorRate: totalOrders[0]?.count > 0 ? ((failedOrders[0]?.count || 0) / totalOrders[0].count * 100) : 0,
      totalOrders: totalOrders[0]?.count || 0,
    };
  });

  // Admin: webhook health check — endpoint response times and error rates
  app.get('/api/v1/admin/webhooks/health', { preHandler: [authenticate, requireAdmin] }, async () => {
    const sources = ['swiggy', 'zomato', 'urbanpiper', 'posist', 'generic'];
    const last24h = new Date();
    last24h.setDate(last24h.getDate() - 1);
    const last7d = new Date();
    last7d.setDate(last7d.getDate() - 7);

    const healthData = await Promise.all(sources.map(async (source) => {
      // Last 24h stats
      const last24hStats = await db.select({
        total: count(),
        failed: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'failed' THEN 1 ELSE 0 END)`.as('failed'),
        created: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'created' THEN 1 ELSE 0 END)`.as('created'),
        avgProcessingTime: sql<number>`AVG(CASE WHEN ${incomingOrders.processedAt} IS NOT NULL THEN EXTRACT(EPOCH FROM (${incomingOrders.processedAt} AT TIME ZONE 'UTC' - ${incomingOrders.createdAt} AT TIME ZONE 'UTC')) END)`.as('avg_processing_time'),
      }).from(incomingOrders)
        .where(and(gte(incomingOrders.createdAt, last24h), eq(incomingOrders.source, source)));

      // Last 7d stats
      const last7dStats = await db.select({
        total: count(),
        failed: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'failed' THEN 1 ELSE 0 END)`.as('failed'),
        created: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'created' THEN 1 ELSE 0 END)`.as('created'),
      }).from(incomingOrders)
        .where(and(gte(incomingOrders.createdAt, last7d), eq(incomingOrders.source, source)));

      // Latest order
      const [latestOrder] = await db.select().from(incomingOrders)
        .where(eq(incomingOrders.source, source))
        .orderBy(desc(incomingOrders.createdAt))
        .limit(1);

      const stats24h = last24hStats[0];
      const stats7d = last7dStats[0];
      const errorRate24h = stats24h.total > 0 ? ((stats24h.failed || 0) / stats24h.total * 100) : 0;
      const errorRate7d = stats7d.total > 0 ? ((stats7d.failed || 0) / stats7d.total * 100) : 0;

      // Determine health status
      let healthStatus: string;
      if (stats24h.total === 0) healthStatus = 'no_data';
      else if (errorRate24h > 20) healthStatus = 'critical';
      else if (errorRate24h > 5) healthStatus = 'degraded';
      else healthStatus = 'healthy';

      return {
        source,
        healthStatus,
        last24h: {
          total: stats24h.total,
          failed: stats24h.failed || 0,
          created: stats24h.created || 0,
          errorRate: Math.round(errorRate24h * 100) / 100,
          avgProcessingTimeSeconds: stats24h.avgProcessingTime ? Math.round(stats24h.avgProcessingTime * 10) / 10 : null,
        },
        last7d: {
          total: stats7d.total,
          failed: stats7d.failed || 0,
          created: stats7d.created || 0,
          errorRate: Math.round(errorRate7d * 100) / 100,
        },
        latestOrder: latestOrder ? {
          externalId: latestOrder.externalId,
          status: latestOrder.status,
          createdAt: latestOrder.createdAt,
          errorMessage: latestOrder.errorMessage,
        } : null,
      };
    }));

    return { sources: healthData };
  });

  // Admin: check alert thresholds and return triggered alerts
  app.post('/api/v1/admin/webhooks/alerts/check', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { rules = [] } = request.body as { rules?: Array<{ id: string; source: string; thresholdPercent: number; windowMinutes: number; enabled: boolean }> };
    const triggered: any[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const since = new Date();
      since.setMinutes(since.getMinutes() - rule.windowMinutes);

      const whereClause = rule.source === 'all'
        ? gte(incomingOrders.createdAt, since)
        : and(gte(incomingOrders.createdAt, since), eq(incomingOrders.source, rule.source));

      const stats = await db.select({
        total: count(),
        failed: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'failed' THEN 1 ELSE 0 END)`.as('failed'),
      }).from(incomingOrders).where(whereClause);

      const total = stats[0]?.total || 0;
      const failed = stats[0]?.failed || 0;
      const errorRate = total > 0 ? (failed / total * 100) : 0;

      if (errorRate >= rule.thresholdPercent && total >= 3) {
        const entry = {
          ruleId: rule.id,
          source: rule.source,
          errorRate: Math.round(errorRate * 100) / 100,
          failedCount: failed,
          totalCount: total,
          windowMinutes: rule.windowMinutes,
          thresholdPercent: rule.thresholdPercent,
        };
        triggered.push(entry);
        // Log the alert for history
        await pushAlertLog({
          source: entry.source,
          errorRate: entry.errorRate,
          failedCount: entry.failedCount,
          totalCount: entry.totalCount,
          message: `${entry.source}: ${entry.errorRate}% error rate (${entry.failedCount}/${entry.totalCount} failed in ${entry.windowMinutes}min)`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Dispatch batched notification (one per check cycle to avoid flooding)
    let notifications: any[] = [];
    if (triggered.length > 0) {
      // Combine all triggered alerts into a single notification
      const worstAlert = triggered.reduce((worst, a) => a.errorRate > worst.errorRate ? a : worst, triggered[0]);
      try {
        const result = await sendWebhookAlertNotification({
          source: triggered.length === 1 ? worstAlert.source : 'all',
          errorRate: worstAlert.errorRate,
          failedCount: triggered.reduce((sum, a) => sum + a.failedCount, 0),
          totalCount: triggered.reduce((sum, a) => sum + a.totalCount, 0),
          windowMinutes: worstAlert.windowMinutes,
          thresholdPercent: worstAlert.thresholdPercent,
          timestamp: new Date().toISOString(),
        });
        notifications = triggered.map(a => ({ ruleId: a.ruleId, channels: result }));
      } catch (err: any) {
        notifications = triggered.map(a => ({ ruleId: a.ruleId, error: err.message }));
      }
    }

    return { triggered, notifications, checkedAt: new Date().toISOString() };
  });

  // Admin: get alert history logs
  app.get('/api/v1/admin/webhooks/alerts/logs', { preHandler: [authenticate, requireAdmin] }, async () => {
    return { logs: await getAlertLogs() };
  });

  // Admin: replay historical webhook orders for testing
  app.post('/api/v1/admin/webhooks/replay', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { orderIds, count: countParam = 1, source = 'generic' } = request.body as {
      orderIds?: number[];
      count?: number;
      source?: string;
    };

    // Get orders to replay
    let ordersToReplay: any[] = [];
    if (orderIds?.length) {
      ordersToReplay = await db.select().from(incomingOrders)
        .where(inArray(incomingOrders.id, orderIds));
    } else {
      // Replay most recent N orders
      ordersToReplay = await db.select().from(incomingOrders)
        .orderBy(desc(incomingOrders.createdAt))
        .limit(countParam);
    }

    if (ordersToReplay.length === 0) {
      return reply.status(404).send({ error: 'No orders found to replay' });
    }

    const results: any[] = [];
    for (const orig of ordersToReplay) {
      // Generate a new unique external ID for the replayed order
      const replayPayload = {
        ...orig.payload,
        order_id: `REPLAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };

      const orderData = normalizeOrderPayload(source, replayPayload);

      // Store as new incoming order
      const [stored] = await db.insert(incomingOrders).values({
        externalId: orderData.externalId,
        source,
        customerName: `[REPLAY] ${orderData.customerName}`,
        customerPhone: orderData.customerPhone,
        customerAddress: orderData.customerAddress,
        payload: replayPayload,
        status: 'received',
      }).returning();

      // Auto-create internal order
      try {
        const totalAmount = orderData.items.reduce(
          (sum: number, item: any) => sum + item.unitPrice * item.quantity, 0
        );

        const [order] = await db.insert(orders).values({
          status: 'CONFIRMED',
          totalAmount: totalAmount.toString(),
          notes: `[replay:${source}] ${orderData.customerAddress || ''}`,
          paymentIntentId: null,
        }).returning();

        for (const item of orderData.items) {
          await db.insert(orderItems).values({
            orderId: order.id,
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            modifiers: item.modifiers || [],
          });
        }

        await db.insert(orderStatusHistory).values({
          orderId: order.id,
          toStatus: 'CONFIRMED',
          changedBy: `webhook:replay:${source}`,
        });

        await db.update(incomingOrders)
          .set({ internalOrderId: order.id, status: 'created', processedAt: new Date() })
          .where(eq(incomingOrders.id, stored.id));

        results.push({ success: true, incomingId: stored.id, orderId: order.id, externalId: orderData.externalId });
      } catch (err: any) {
        await db.update(incomingOrders)
          .set({ status: 'failed', errorMessage: err.message })
          .where(eq(incomingOrders.id, stored.id));
        results.push({ success: false, incomingId: stored.id, error: err.message });
      }
    }

    return { results, total: results.length, succeeded: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
  });

  // Admin: replay history (list past replay attempts)
  app.get('/api/v1/admin/webhooks/replay/history', { preHandler: [authenticate, requireAdmin] }, async () => {
    const replays = await db.select().from(incomingOrders)
      .where(ilike(incomingOrders.externalId, 'REPLAY-%'))
      .orderBy(desc(incomingOrders.createdAt))
      .limit(100);
    return { replays, total: replays.length };
  });

  // Admin: replay a specific delivery by ID
  app.post('/api/v1/admin/webhooks/replay/:deliveryId', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { deliveryId } = request.params as { deliveryId: string };
    const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, parseInt(deliveryId)));
    if (!delivery) return reply.status(404).send({ error: 'Delivery not found' });

    // Create a new delivery attempt
    const [newDelivery] = await db.insert(webhookDeliveries).values({
      endpointId: delivery.endpointId,
      event: delivery.event,
      payload: delivery.payload as any,
      status: 'pending',
      attempts: 0,
    }).returning();

    // Attempt to redeliver with exponential backoff
    const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, delivery.endpointId!));
    if (endpoint) {
      const delays = [5000, 15000, 45000];
      let lastError: string | undefined;
      let attempts = 0;

      for (let i = 0; i <= delays.length; i++) {
        attempts = i + 1;
        try {
          const res = await fetch(endpoint.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': delivery.event },
            body: JSON.stringify(delivery.payload),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            await db.update(webhookDeliveries)
              .set({ status: 'success', statusCode: res.status, attempts, completedAt: new Date() })
              .where(eq(webhookDeliveries.id, newDelivery.id));
            return { success: true, deliveryId: newDelivery.id, attempts };
          }
          lastError = `HTTP ${res.status}`;
        } catch (err: any) {
          lastError = err.message;
        }
        if (i < delays.length) {
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }

      await db.update(webhookDeliveries)
        .set({ status: 'failed', errorMessage: lastError, attempts, completedAt: new Date() })
        .where(eq(webhookDeliveries.id, newDelivery.id));
      return { success: false, deliveryId: newDelivery.id, error: lastError, attempts };
    }
    return { success: false, deliveryId: newDelivery.id, error: 'Endpoint not found' };
  });

  // ═══════════════════════════════════════════════════════════════
  //  WEBHOOK ENDPOINT MANAGEMENT (Outbound webhooks)
  // ═══════════════════════════════════════════════════════════════

  // Admin: list all webhook endpoints
  app.get('/api/v1/admin/webhooks', { preHandler: [authenticate, requireAdmin] }, async () => {
    const endpoints = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt));
    return { webhooks: endpoints, total: endpoints.length };
  });

  // Admin: create a new webhook endpoint
  app.post('/api/v1/admin/webhooks', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { name, url, events } = request.body as { name: string; url: string; events?: string[] };
    if (!name || !url) return reply.status(400).send({ error: 'Name and URL are required' });

    try {
      new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Invalid URL format' });
    }

    if (!isSafeUrl(url)) {
      return reply.status(400).send({ error: 'URL must point to a public, non-internal host' });
    }

    const [endpoint] = await db.insert(webhookEndpoints).values({
      name,
      url,
      events: events || ['*'],
      isActive: true,
    }).returning();

    return { webhook: endpoint };
  });

  // Admin: toggle webhook endpoint active status
  app.post('/api/v1/admin/webhooks/:id/toggle', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, parseInt(id)));
    if (!existing) return { error: 'Webhook endpoint not found' };

    const [updated] = await db.update(webhookEndpoints)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(webhookEndpoints.id, parseInt(id)))
      .returning();

    return { webhook: updated };
  });

  // Admin: delete a webhook endpoint
  app.delete('/api/v1/admin/webhooks/:id', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.endpointId, parseInt(id)));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, parseInt(id)));
    return { success: true };
  });

  // Admin: test a webhook endpoint (send a test ping)
  app.post('/api/v1/admin/webhooks/:id/test', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, parseInt(id)));
    if (!endpoint) return { error: 'Webhook endpoint not found' };

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Test webhook from The Katanguri\'s Kitchen',
        endpointId: endpoint.id,
        endpointName: endpoint.name,
      },
    };

    const startTime = Date.now();
    let statusCode = 0;
    let responseBody = '';
    let success = false;

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'webhook.test',
          'X-Webhook-Signature': endpoint.secret ? 'test-signature' : '',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });
      statusCode = res.status;
      responseBody = await res.text().catch(() => '');
      success = res.ok;
    } catch (err: any) {
      responseBody = err.message;
    }

    const durationMs = Date.now() - startTime;

    // Record delivery
    await db.insert(webhookDeliveries).values({
      endpointId: endpoint.id,
      event: 'webhook.test',
      payload: testPayload as any,
      status: success ? 'success' : 'failed',
      statusCode,
      responseBody: responseBody.slice(0, 1000),
      attempts: 1,
      completedAt: new Date(),
    });

    // Update endpoint stats
    await db.update(webhookEndpoints)
      .set({
        lastTriggeredAt: new Date(),
        successCount: (endpoint.successCount || 0) + (success ? 1 : 0),
        failureCount: (endpoint.failureCount || 0) + (success ? 0 : 1),
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, endpoint.id));

    return {
      success,
      statusCode,
      durationMs,
      responseBody: responseBody.slice(0, 500),
    };
  });

  // Admin: get webhook deliveries history
  app.get('/api/v1/admin/webhooks/deliveries', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { limit = '50', offset = '0', endpointId, status } = request.query as {
      limit?: string; offset?: string; endpointId?: string; status?: string;
    };

    let whereClause = undefined;
    if (endpointId) whereClause = eq(webhookDeliveries.endpointId, parseInt(endpointId));
    if (status) whereClause = and(whereClause, eq(webhookDeliveries.status, status)) as any;

    const query = db.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt));
    const deliveries = whereClause
      ? await query.where(whereClause).limit(parseInt(limit)).offset(parseInt(offset))
      : await query.limit(parseInt(limit)).offset(parseInt(offset));

    return { deliveries, total: deliveries.length };
  });

  // ═══════════════════════════════════════════════════════════════
  //  WEBHOOK ALERTS (managed in DB instead of Redis only)
  // ═══════════════════════════════════════════════════════════════

  // Admin: list alerts (with optional severity filter)
  app.get('/api/v1/admin/webhooks/alerts', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { severity, limit = '50' } = request.query as { severity?: string; limit?: string };

    let whereClause = undefined;
    if (severity) whereClause = eq(webhookAlerts.severity, severity);

    const query = db.select().from(webhookAlerts).orderBy(desc(webhookAlerts.createdAt));
    const alerts = whereClause
      ? await query.where(whereClause).limit(parseInt(limit))
      : await query.limit(parseInt(limit));

    return { alerts, total: alerts.length };
  });

  // Admin: acknowledge an alert
  app.post('/api/v1/admin/webhooks/alerts/:id/acknowledge', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const [existing] = await db.select().from(webhookAlerts).where(eq(webhookAlerts.id, parseInt(id)));
    if (!existing) return reply.status(404).send({ error: 'Alert not found' });
    if (existing.acknowledged) return { message: 'Alert already acknowledged' };

    const [updated] = await db.update(webhookAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: user?.customerId,
        acknowledgedAt: new Date(),
      })
      .where(eq(webhookAlerts.id, parseInt(id)))
      .returning();

    return { alert: updated };
  });
}


