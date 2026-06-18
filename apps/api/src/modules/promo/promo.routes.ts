import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { promoCodes } from '../../db/schemas/feedback.js';
import { orders } from '../../db/schemas/order.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { createPromoSchema } from '../../lib/validation.js';
import { redis } from '../../utils/redis.js';
import { z } from 'zod';

const PROMO_RATE_LIMIT = 30;
const PROMO_APPLY_RATE_LIMIT = 10;
const PROMO_RATE_WINDOW = 15 * 60;

async function checkPromoRateLimit(ip: string, max: number = PROMO_RATE_LIMIT): Promise<boolean> {
  const key = `ratelimit:promo:${ip}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, PROMO_RATE_WINDOW);
    return current <= max;
  } catch {
    return true;
  }
}

const promoValidateSchema = z.object({
  code: z.string().min(1).max(50),
  orderAmount: z.number().positive(),
});

const promoApplySchema = z.object({
  code: z.string().min(1).max(50),
  orderId: z.number().int().positive(),
});

export async function promoRoutes(app: FastifyInstance) {
  app.post('/api/v1/promo/validate', async (request, reply) => {
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkPromoRateLimit(ip))) {
      return reply.status(429).send({ error: 'Too many promo validation requests. Try again later.' });
    }

    const body = await validateBody(request, reply, promoValidateSchema);
    if (body === null) return;
    const { code, orderAmount } = body;

    const [promo] = await db.select().from(promoCodes)
      .where(eq(promoCodes.code, code.toUpperCase()))
      .limit(1);

    if (!promo) {
      return reply.status(404).send({ valid: false, error: 'Invalid promo code' });
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return reply.status(400).send({ valid: false, error: 'Promo code expired' });
    }

    const maxUses = promo.maxUses ?? 0;
    const currentUses = promo.currentUses ?? 0;
    if (maxUses > 0 && currentUses >= maxUses) {
      return reply.status(400).send({ valid: false, error: 'Promo code usage limit reached' });
    }

    const minOrderAmount = promo.minOrderAmount ?? 0;
    if (orderAmount < minOrderAmount) {
      return reply.status(400).send({ valid: false, error: `Minimum order amount is ₹${promo.minOrderAmount}` });
    }

    let discount = 0;
    if (promo.type === 'percentage') {
      discount = Math.round(orderAmount * (promo.value / 100) * 100) / 100;
    } else {
      discount = promo.value;
    }

    return {
      valid: true,
      promoId: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount,
      description: promo.type === 'percentage' ? `${promo.value}% off` : `₹${promo.value} off`,
    };
  });

  app.post('/api/v1/promo/apply', { preHandler: [authenticate] }, async (request, reply) => {
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkPromoRateLimit(ip, PROMO_APPLY_RATE_LIMIT))) {
      return reply.status(429).send({ error: 'Too many promo apply requests. Try again later.' });
    }

    const body = await validateBody(request, reply, promoApplySchema);
    if (body === null) return;
    const { code, orderId } = body;

    const user = request.user;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    
    // Check order ownership
    if (user.role !== 'admin' && order.customerId !== user.customerId) {
      return reply.status(403).send({ error: 'Not your order' });
    }

    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
    if (!promo) return reply.status(404).send({ error: 'Invalid promo code' });

    if ((promo.maxUses ?? 0) > 0) {
      const [updated] = await db.update(promoCodes)
        .set({ currentUses: sql`${promoCodes.currentUses} + 1` })
        .where(and(
          eq(promoCodes.id, promo.id),
          sql`${promoCodes.currentUses} < ${promoCodes.maxUses}`
        ))
        .returning();

      if (!updated) {
        return reply.status(400).send({ error: 'Promo code usage limit reached' });
      }
    }

    return { success: true, orderId, code };
  });

  app.post('/api/v1/admin/promo-codes', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = await validateBody(request, reply, createPromoSchema);
    if (body === null) return;
    const { code, type, value, minOrderAmount, maxUses, expiresAt } = body;

    const [promo] = await db.insert(promoCodes).values({
      code: code.toUpperCase(),
      type,
      value,
      minOrderAmount: minOrderAmount ?? 0,
      maxUses: maxUses ?? 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    return { promo };
  });

  app.get('/api/v1/admin/promo-codes', { preHandler: [authenticate, requireAdmin] }, async () => {
    const promos = await db.select().from(promoCodes).orderBy(promoCodes.createdAt);
    return { promos };
  });
}
