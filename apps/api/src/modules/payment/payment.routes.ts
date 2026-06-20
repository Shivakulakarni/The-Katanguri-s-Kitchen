import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { payments } from '../../db/schemas/payment.js';
import { orders } from '../../db/schemas/order.js';
import { orderStatusHistory } from '../../db/schemas/order.js';
import { eq, and, sql, gte, count, inArray } from 'drizzle-orm';
import { publishEvent } from '../../utils/eventBus.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { redis } from '../../utils/redis.js';
import { Errors } from '../../lib/errors.js';
import { validateBody } from '../../lib/validate.js';
import { createPaymentIntentSchema, adminRefundSchema } from '../../lib/validation.js';
import { STRIPE_API_VERSION } from '../../lib/constants.js';
import { logger } from '../../utils/logger.js';
const IDEMPOTENCY_TTL = 86400;

let stripeInstance: import('stripe').Stripe | null = null;
async function getStripe() {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_CHANGE_ME') return null;
  const Stripe = (await import('stripe')).default;
  stripeInstance = new Stripe(key, { apiVersion: STRIPE_API_VERSION as any });
  return stripeInstance;
}

// SECURITY: Atomic check-and-set to prevent TOCTOU race condition
async function claimIdempotency(key: string): Promise<boolean> {
  const result = await redis.set(`idempotency:${key}`, '1', 'EX', IDEMPOTENCY_TTL, 'NX');
  return result === 'OK';
}

async function logPaymentAudit(orderId: number, action: string, details: Record<string, unknown>) {
  try {
    await db.insert(orderStatusHistory).values({
      orderId,
      toStatus: action,
      changedBy: 'payment_system',
      notes: JSON.stringify(details),
    });
  } catch {
    // Audit log failure should not block payment processing
  }
}

export async function paymentRoutes(app: FastifyInstance) {
  app.post('/api/v1/payments/create-intent', { preHandler: [authenticate] }, async (request, reply) => {
    const body = await validateBody(request, reply, createPaymentIntentSchema);
    if (body === null) return;
    const { orderId, currency, idempotencyKey } = body;

    // SECURITY: Derive amount from server-side order, never trust client
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }
    // Verify order belongs to the authenticated user (or admin)
    const user = request.user;
    if (order.customerId !== user.customerId && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized' });
    }
    const amount = parseFloat(order.totalAmount.toString());

    const stripe = await getStripe();
    if (!stripe) {
      // COD fallback: Create a pending COD payment record
      const codKey = `cod_${orderId}`;
      if (!await claimIdempotency(codKey)) {
        return { method: 'cod', status: 'pending', orderId, existing: true };
      }
      await db.insert(payments).values({
        orderId,
        gateway: 'cod',
        paymentIntentId: `cod_${orderId}_${Date.now()}`,
        amount: amount.toString(),
        currency: (currency || 'INR').toUpperCase(),
        status: 'pending',
      });
      await logPaymentAudit(orderId, 'COD_PAYMENT_CREATED', { orderId, amount });
      return { method: 'cod', status: 'pending', orderId, message: 'Cash on Delivery — pay when you receive your order' };
    }

    const idKey = idempotencyKey || `pi_create_${orderId}`;
    if (!await claimIdempotency(idKey)) {
      const existing = await db.select().from(payments)
        .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')))
        .limit(1);
      if (existing.length > 0) {
        return { clientSecret: null, paymentIntentId: existing[0].paymentIntentId, existing: true };
      }
      return reply.status(409).send({ error: 'Duplicate request — order already processing' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency || 'inr',
      metadata: { orderId: orderId.toString() },
    }, { idempotencyKey: idKey });

    await db.insert(payments).values({
      orderId,
      gateway: 'stripe',
      paymentIntentId: paymentIntent.id,
      amount: amount.toString(),
      currency: (currency || 'INR').toUpperCase(),
      status: 'pending',
    });

    await logPaymentAudit(orderId, 'PAYMENT_INTENT_CREATED', { paymentIntentId: paymentIntent.id, amount });

    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  });

  app.post('/api/v1/webhooks/stripe', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret === 'whsec_CHANGE_ME') {
      return reply.status(503).send({ error: 'Stripe webhook endpoint is not configured', code: 'STRIPE_NOT_CONFIGURED' });
    }

    let event;
    try {
      const stripe = await getStripe();
      if (!stripe) return reply.status(500).send({ error: 'Payment service not configured' });
      const rawBody = (request as any).rawBody || JSON.stringify((request as any).body);
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' });
    }

    const eventId = event.id;
    if (!await claimIdempotency(`stripe:${eventId}`)) {
      return { received: true, duplicate: true };
    }

    const pi = event.data.object as any;
    const orderId = parseInt(pi.metadata?.orderId);

    switch (event.type) {
      case 'payment_intent.succeeded':
        if (orderId) {
          const [currentOrder] = await db.select({ status: orders.status })
            .from(orders).where(eq(orders.id, orderId)).limit(1);
          if (currentOrder) {
            const finalStatuses = ['CANCELLED', 'DELIVERED', 'REJECTED'];
            if (finalStatuses.includes(currentOrder.status)) {
              logger.warn({ orderId, currentStatus: currentOrder.status }, '[Webhook] Skipping payment_intent.succeeded - order in final status');
              break;
            }
          }
          await db.transaction(async (tx) => {
            await tx.update(orders).set({ status: 'CONFIRMED', paymentIntentId: pi.id, updatedAt: new Date() }).where(eq(orders.id, orderId));
            await tx.update(payments).set({ status: 'succeeded' }).where(eq(payments.paymentIntentId, pi.id));
            await tx.insert(orderStatusHistory).values({ orderId, toStatus: 'CONFIRMED', changedBy: 'stripe_webhook' });
          });
          await publishEvent('order.confirmed', { orderId, paymentIntentId: pi.id });
          await logPaymentAudit(orderId, 'PAYMENT_SUCCEEDED', { paymentIntentId: pi.id, amount: pi.amount_received });
        }
        break;

      case 'payment_intent.payment_failed':
        await db.update(payments).set({ status: 'failed' }).where(eq(payments.paymentIntentId, pi.id));
        if (orderId) {
          await logPaymentAudit(orderId, 'PAYMENT_FAILED', { paymentIntentId: pi.id, error: pi.last_payment_error?.message });
        }
        break;

      case 'charge.refunded':
        await db.update(payments).set({ status: 'refunded' }).where(eq(payments.paymentIntentId, pi.payment_intent));
        if (orderId) {
          await publishEvent('payment.refunded', { orderId, paymentIntentId: pi.payment_intent, refundId: pi.id });
          await logPaymentAudit(orderId, 'PAYMENT_REFUNDED', { chargeId: pi.id, amount: pi.amount_refunded });
        }
        break;

      case 'charge.succeeded':
        if (orderId) {
          await logPaymentAudit(orderId, 'CHARGE_SUCCEEDED', { chargeId: pi.id, amount: pi.amount });
        }
        break;
    }

    return { received: true };
  });

  app.post('/api/v1/admin/payments/refund', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = await validateBody(request, reply, adminRefundSchema);
    if (body === null) return;
    const { paymentIntentId, amount, reason } = body;
    if (!paymentIntentId) {
      const err = Errors.badRequest('paymentIntentId required');
      return reply.status(err.statusCode).send({ error: err.message });
    }

    const stripe = await getStripe();
    if (!stripe) {
      const err = Errors.serviceUnavailable('Payment service not configured');
      return reply.status(err.statusCode).send({ error: err.message });
    }

    const [paymentRecord] = await db.select().from(payments)
      .where(eq(payments.paymentIntentId, paymentIntentId))
      .limit(1);

    if (!paymentRecord) {
      const err = Errors.notFound('Payment not found');
      return reply.status(err.statusCode).send({ error: err.message });
    }
    if (paymentRecord.status !== 'succeeded') {
      const err = Errors.badRequest(`Cannot refund payment in status: ${paymentRecord.status}`);
      return reply.status(err.statusCode).send({ error: err.message });
    }

    const refundAmount = amount ? Math.round(amount * 100) : undefined;
    const originalAmount = Math.round(parseFloat(paymentRecord.amount) * 100);
    if (refundAmount && refundAmount > originalAmount) {
      return reply.status(400).send({ error: 'Refund amount exceeds original charge' });
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmount,
        metadata: { reason: reason || 'admin_request', refundedBy: (request as any).user?.customerId?.toString() || 'admin' },
      });

      await db.update(payments).set({ status: 'refunded' }).where(eq(payments.paymentIntentId, paymentIntentId));
      await db.insert(orderStatusHistory).values({
        orderId: paymentRecord.orderId,
        toStatus: 'REFUNDED',
        changedBy: `admin:${(request as any).user?.customerId || 'unknown'}`,
        notes: JSON.stringify({ refundId: refund.id, amount: refundAmount, reason: reason || 'admin_request' }),
      });
      await publishEvent('payment.refunded', { orderId: paymentRecord.orderId, paymentIntentId, refundId: refund.id });

      return { success: true, refundId: refund.id, amount: refund.amount };
    } catch {
      return reply.status(500).send({ error: 'Refund processing failed' });
    }
  });

  app.get('/api/v1/admin/payments/reconciliation', { preHandler: [authenticate, requireAdmin] }, async () => {
    const pending = await db.select({ count: count() }).from(payments).where(eq(payments.status, 'pending'));
    const failed = await db.select({ count: count() }).from(payments).where(eq(payments.status, 'failed'));
    const succeeded = await db.select({ count: count() }).from(payments).where(eq(payments.status, 'succeeded'));
    const refunded = await db.select({ count: count() }).from(payments).where(eq(payments.status, 'refunded'));

    const totalRevenue = await db.select({
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
    }).from(payments).where(eq(payments.status, 'succeeded'));

    const todayRevenue = await db.select({
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
    }).from(payments).where(and(
      eq(payments.status, 'succeeded'),
      gte(payments.createdAt, sql`CURRENT_DATE`),
    ));

    return {
      counts: {
        pending: pending[0].count,
        failed: failed[0].count,
        succeeded: succeeded[0].count,
        refunded: refunded[0].count,
      },
      totalRevenue: totalRevenue[0].total,
      todayRevenue: todayRevenue[0].total,
    };
  });

  app.post('/api/v1/admin/payments/reconcile', { preHandler: [authenticate, requireAdmin] }, async (_request, reply) => {
    const stripe = await getStripe();
    if (!stripe) {
      return reply.status(500).send({ error: 'Payment service not configured' });
    }

    try {
      const balanceTransactions = await stripe.balanceTransactions.list({ limit: 100 });
      const reconciled: string[] = [];
      const discrepancies: string[] = [];

      const paymentIntentIds = balanceTransactions.data
        .map(tx => tx.source as string)
        .filter(Boolean);

      const matchingPayments = paymentIntentIds.length > 0
        ? await db.select().from(payments)
            .where(inArray(payments.paymentIntentId, paymentIntentIds))
        : [];

      const paymentMap = new Map(matchingPayments.map(p => [p.paymentIntentId, p]));
      const seenTxIds = new Set<string>();

      for (const tx of balanceTransactions.data) {
        const matchingPayment = paymentMap.get(tx.source as string);

        if (matchingPayment && !seenTxIds.has(tx.id)) {
          seenTxIds.add(tx.id);
          const expectedAmount = Math.round(parseFloat(matchingPayment.amount) * 100);
          const diff = Math.abs(tx.amount - expectedAmount);
          const diffPercent = expectedAmount > 0 ? (diff / expectedAmount) * 100 : 0;

          if (diffPercent > 0.5) {
            discrepancies.push(`Order #${matchingPayment.orderId}: expected ${expectedAmount}, got ${tx.amount}`);
          } else {
            reconciled.push(tx.id);
          }
        }
      }

      return {
        reconciled: reconciled.length,
        discrepancies: discrepancies.length,
        discrepancyDetails: discrepancies,
        totalTransactions: balanceTransactions.data.length,
      };
    } catch {
      return reply.status(500).send({ error: 'Reconciliation failed' });
    }
  });
}
