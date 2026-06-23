import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { orders, orderItems, orderStatusHistory } from '../../db/schemas/order.js';

import { eq, desc, inArray, and, sql } from 'drizzle-orm';
import { dishes } from '../../db/schemas/menu.js';
import { customerAddresses } from '../../db/schemas/customer.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { publishEvent } from '../../utils/eventBus.js';
import { ORDER_STATUS_FLOW, OrderStatus } from '../../types/index.js';
import { createOrderSchema } from '../../lib/validation.js';
import { validateBody } from '../../lib/validate.js';
import { sanitizeText } from '../../lib/sanitize.js';
import { STRIPE_API_VERSION } from '../../lib/constants.js';
import { redis } from '../../utils/redis.js';
import { auditLog } from '../../utils/audit.js';
import Stripe from 'stripe';

const IDEMPOTENCY_TTL = 86400;

async function claimIdempotency(key: string): Promise<boolean> {
  const result = await redis.set(`idempotency:${key}`, '1', 'EX', IDEMPOTENCY_TTL, 'NX');
  return result === 'OK';
}

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/api/v1/orders', async (request, reply) => {
    try {
      const body = await validateBody(request, reply, createOrderSchema);
      if (body === null) return; // validation failed, reply already sent

      const user = request.user;
      const { items, deliveryAddressId, notes, idempotencyKey } = body;

      if (idempotencyKey) {
        if (!await claimIdempotency(`order:${idempotencyKey}`)) {
          const existingOrder = await redis.get(`idempotency_order:${idempotencyKey}`);
          if (existingOrder) {
            return { order: JSON.parse(existingOrder) };
          }
          return reply.status(409).send({ error: 'Duplicate request — order already processing' });
        }
      }

      const safeNotes = sanitizeText(notes);

      const dishIds = items.map((item) => item.dishId);
      const menuDishes = await db.select().from(dishes).where(inArray(dishes.id, dishIds));
      const dishMap = new Map(menuDishes.map(d => [d.id, d]));

      const resolvedItems: { dishId: number; quantity: number; unitPrice: number; modifiers: any[] }[] = [];
      for (const item of items) {
        const dish = dishMap.get(item.dishId);
        if (!dish || !dish.isAvailable) {
          return reply.status(400).send({ error: `Dish not found or unavailable: ${item.dishId}` });
        }
        resolvedItems.push({
          dishId: dish.id,
          quantity: item.quantity || 1,
          unitPrice: parseFloat(dish.price),
          modifiers: item.modifiers || [],
        });
      }

      const totalAmount = resolvedItems.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);

      const order = await db.transaction(async (tx) => {
        const [o] = await tx.insert(orders).values({
          customerId: user.customerId,
          status: 'PENDING',
          totalAmount: totalAmount.toString(),
          deliveryAddressId: deliveryAddressId || null,
          paymentIntentId: null,
          notes: safeNotes,
          idempotencyKey: idempotencyKey || null,
          idempotencyKeyCreatedAt: idempotencyKey ? new Date() : null,
        }).returning();

        for (const item of resolvedItems) {
          await tx.insert(orderItems).values({
            orderId: o.id,
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            modifiers: item.modifiers,
          });
        }

        await tx.insert(orderStatusHistory).values({
          orderId: o.id,
          toStatus: 'PENDING',
          changedBy: 'system',
        });

        return o;
      });

      await publishEvent('order.placed', { orderId: order.id, customerId: user.customerId, items: resolvedItems, totalAmount });

      if (idempotencyKey) {
        await redis.set(`idempotency_order:${idempotencyKey}`, JSON.stringify({ ...order, items: resolvedItems }), 'EX', IDEMPOTENCY_TTL);
      }

      return { order: { ...order, items: resolvedItems } };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to create order' });
    }
  });

  const ORDERS_LIST_CACHE_TTL = 15;
  const ORDER_DETAIL_CACHE_TTL = 30;

  app.get('/api/v1/orders', async (request) => {
    const user = request.user;
    const cacheKey = `cache:orders:list:${user.customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const userOrders = await db.select({
      id: orders.id, status: orders.status, totalAmount: orders.totalAmount,
      createdAt: orders.createdAt, updatedAt: orders.updatedAt,
      dispatchId: orders.dispatchId,
    }).from(orders)
      .where(eq(orders.customerId, user.customerId))
      .orderBy(desc(orders.createdAt))
      .limit(50);
    const result = { orders: userOrders };
    await redis.setex(cacheKey, ORDERS_LIST_CACHE_TTL, JSON.stringify(result));
    return result;
  });

  app.get('/api/v1/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;
    const cacheKey = `cache:orders:detail:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.order.customerId === user.customerId || user.role === 'admin') {
        return parsed;
      }
      return reply.status(403).send({ error: 'Not authorized' });
    }
    const [order] = await db.select({
      id: orders.id, customerId: orders.customerId, status: orders.status,
      totalAmount: orders.totalAmount, deliveryAddressId: orders.deliveryAddressId,
      paymentIntentId: orders.paymentIntentId, dispatchId: orders.dispatchId,
      notes: orders.notes, createdAt: orders.createdAt, updatedAt: orders.updatedAt,
    }).from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.customerId !== user.customerId && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized' });
    }

    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;
    if (order.deliveryAddressId) {
      const [address] = await db.select({
        latitude: customerAddresses.latitude,
        longitude: customerAddresses.longitude,
      }).from(customerAddresses).where(eq(customerAddresses.id, order.deliveryAddressId)).limit(1);
      if (address && address.latitude && address.longitude) {
        deliveryLat = parseFloat(address.latitude.toString());
        deliveryLng = parseFloat(address.longitude.toString());
      }
    }
    if (deliveryLat === null || deliveryLng === null) {
      deliveryLat = 17.9784;
      deliveryLng = 79.5941;
    }

    const items = await db.select({
      id: orderItems.id, dishId: orderItems.dishId, quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice, modifiers: orderItems.modifiers,
    }).from(orderItems).where(eq(orderItems.orderId, order.id));
    const history = await db.select({
      fromStatus: orderStatusHistory.fromStatus, toStatus: orderStatusHistory.toStatus,
      changedBy: orderStatusHistory.changedBy, createdAt: orderStatusHistory.createdAt,
    }).from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, order.id))
      .orderBy(desc(orderStatusHistory.createdAt));

    const result = { order: { ...order, deliveryLat, deliveryLng }, items, history };
    await redis.setex(cacheKey, ORDER_DETAIL_CACHE_TTL, JSON.stringify(result));
    return result;
  });

  app.post('/api/v1/orders/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.customerId !== user.customerId && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized' });
    }

    const allowedNext = ORDER_STATUS_FLOW[order.status as OrderStatus] || [];
    if (!allowedNext.includes('CANCELLED')) {
      return reply.status(400).send({ error: `Cannot cancel order in status ${order.status}` });
    }

    const [updated] = await db.transaction(async (tx) => {
      const [u] = await tx.update(orders)
        .set({ status: 'CANCELLED', updatedAt: new Date(), version: sql`${orders.version} + 1` })
        .where(and(eq(orders.id, parseInt(id)), eq(orders.version, order.version)))
        .returning();

      if (!u) return [null as any];

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status as OrderStatus,
        toStatus: 'CANCELLED',
        changedBy: user.role === 'admin' ? 'admin' : 'customer',
      });

      return [u];
    });

    if (!updated) {
      return reply.status(409).send({ error: 'Order was modified by another request' });
    }

    await redis.del(`cache:orders:detail:${id}`);
    await redis.del(`cache:orders:list:${order.customerId}`);

    await publishEvent('order.cancelled', { orderId: order.id, customerId: user.customerId, status: 'CANCELLED' });
    return { order: updated };
  });

  app.patch('/api/v1/admin/orders/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    if (!body?.status || typeof body.status !== 'string') {
      return reply.status(400).send({ error: 'Status is required' });
    }
    const status = body.status as OrderStatus;
    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });

    const allowedNext = ORDER_STATUS_FLOW[order.status as OrderStatus] || [];
    if (!allowedNext.includes(status)) {
      return reply.status(400).send({ error: `Cannot transition from ${order.status} to ${status}` });
    }

    const [updated] = await db.transaction(async (tx) => {
      const [u] = await tx.update(orders)
        .set({ status, updatedAt: new Date(), version: sql`${orders.version} + 1` })
        .where(and(eq(orders.id, parseInt(id)), eq(orders.version, order.version)))
        .returning();

      if (!u) return [null as any];

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status as OrderStatus,
        toStatus: status,
        changedBy: 'admin',
      });

      return [u];
    });

    if (!updated) {
      return reply.status(409).send({ error: 'Order was modified by another request' });
    }

    await redis.del(`cache:orders:detail:${id}`);
    await redis.del(`cache:orders:list:${order.customerId}`);

    const eventMap: Record<string, string> = {
      CONFIRMED: 'order.confirmed',
      PREPARING: 'order.preparation_started',
      READY: 'order.ready',
      OUT_FOR_DELIVERY: 'order.out_for_delivery',
      DELIVERED: 'order.delivered',
    };
    if (eventMap[status]) {
      await publishEvent(eventMap[status], { orderId: order.id, customerId: order.customerId });
    }

    const user = request.user;
    await auditLog({
      entityType: 'order',
      entityId: parseInt(id),
      action: 'update',
      changes: { status: { before: order.status, after: status } },
      ctx: user ? { userId: user.customerId, userRole: user.role } : {},
    });

    return { order: updated };
  });

  app.post('/api/v1/orders/:id/retry-payment', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.customerId !== user.customerId && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized' });
    }
    if (order.status !== 'PENDING') {
      return reply.status(400).send({ error: `Cannot retry payment for order in status ${order.status}` });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey === 'sk_test_CHANGE_ME') {
      return reply.status(400).send({ error: 'Payment retry is not available for Cash on Delivery orders' });
    }

    try {
      const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION as any });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(order.totalAmount.toString()) * 100),
        currency: 'inr',
        metadata: { orderId: order.id.toString() },
      }, { idempotencyKey: `retry_${order.id}_${Date.now()}` });

      return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
    } catch {
      return reply.status(500).send({ error: 'Payment retry failed. Please try again or contact support.' });
    }
  });
}
