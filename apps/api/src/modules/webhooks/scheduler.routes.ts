import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { incomingOrders } from '../../db/schemas/delivery.js';
import { orders, orderItems, orderStatusHistory } from '../../db/schemas/order.js';
import { eq, and, count } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';

/**
 * Scheduler routes for automatic webhook order retry and alert notifications.
 */
export async function schedulerRoutes(app: FastifyInstance) {
  // Admin: auto-retry failed webhook orders
  app.post('/api/v1/admin/webhooks/scheduler/retry-failed', { preHandler: [authenticate, requireAdmin] }, async (request, _reply) => {
    const { batchSize = 5, source } = request.body as { batchSize?: number; source?: string };

    // Find failed orders
    const whereClause = source
      ? and(eq(incomingOrders.status, 'failed'), eq(incomingOrders.source, source))
      : eq(incomingOrders.status, 'failed');

    const failedOrders = await db.select().from(incomingOrders)
      .where(whereClause)
      .orderBy(incomingOrders.createdAt)
      .limit(batchSize);

    const results: any[] = [];
    for (const failed of failedOrders) {
      // Skip if already has an internal order (prevents duplicate creation)
      if (failed.internalOrderId) {
        results.push({ id: failed.id, skipped: true, reason: 'Already has internal order #' + failed.internalOrderId });
        continue;
      }
      try {
        // Create new internal order from failed payload
        const payload = failed.payload as any;
        const items = payload.items || payload.order_items || [];
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.unit_price || item.price || 0) * (item.quantity || 1), 0);

        const [order] = await db.insert(orders).values({
          status: 'CONFIRMED',
          totalAmount: totalAmount.toString(),
          notes: `[auto-retry:${failed.source}] ${failed.customerAddress || ''}`,
          paymentIntentId: null,
        }).returning();

        for (const item of items) {
          await db.insert(orderItems).values({
            orderId: order.id,
            dishId: item.dish_id || item.item_id || item.id,
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || item.price || 0,
            modifiers: item.modifiers || [],
          });
        }

        await db.insert(orderStatusHistory).values({
          orderId: order.id,
          toStatus: 'CONFIRMED',
          changedBy: `scheduler:auto-retry`,
        });

        // Update incoming order
        await db.update(incomingOrders)
          .set({ internalOrderId: order.id, status: 'created', processedAt: new Date(), errorMessage: null })
          .where(eq(incomingOrders.id, failed.id));

        results.push({ id: failed.id, success: true, orderId: order.id });
      } catch (err: any) {
        results.push({ id: failed.id, success: false, error: err.message });
      }
    }

    return {
      retried: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  });

  // Admin: get scheduler status and configuration
  app.get('/api/v1/admin/webhooks/scheduler/status', { preHandler: [authenticate, requireAdmin] }, async () => {
    const failedCount = await db.select({ count: count() }).from(incomingOrders)
      .where(eq(incomingOrders.status, 'failed'));

    const totalOrders = await db.select({ count: count() }).from(incomingOrders);
    const createdOrders = await db.select({ count: count() }).from(incomingOrders)
      .where(eq(incomingOrders.status, 'created'));

    return {
      scheduler: {
        autoRetryEnabled: true,
        maxRetriesPerRun: 5,
        checkIntervalMinutes: 15,
      },
      stats: {
        totalIncoming: totalOrders[0]?.count || 0,
        successfullyCreated: createdOrders[0]?.count || 0,
        currentlyFailed: failedCount[0]?.count || 0,
      },
    };
  });
}
