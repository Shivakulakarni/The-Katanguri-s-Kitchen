import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { feedbacks } from '../../db/schemas/feedback.js';
import { orders } from '../../db/schemas/order.js';
import { eq, desc, sql } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { aiQueue } from '../../utils/queue.js';
import { hasGeminiKey } from '../ai/ai.service.js';

export async function feedbackRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/api/v1/orders/:id/feedback', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rating, comment } = request.body as { rating: string | number; comment?: string };
    const user = request.user;

    const ratingStr = String(rating);
    if (!['1', '2', '3', '4', '5'].includes(ratingStr)) {
      return reply.status(400).send({ error: 'Rating must be 1-5' });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.customerId !== user.customerId) {
      return reply.status(403).send({ error: 'Not your order' });
    }

    const existing = await db.select().from(feedbacks).where(eq(feedbacks.orderId, order.id)).limit(1);
    if (existing.length > 0) {
      return reply.status(400).send({ error: 'Already submitted feedback for this order' });
    }

    const [feedback] = await db.insert(feedbacks).values({
      orderId: order.id,
      customerId: user.customerId,
      rating: ratingStr as any,
      comment: comment?.trim().slice(0, 1000) || null,
    }).returning();

    if (hasGeminiKey() && comment?.trim()) {
      aiQueue.add('sentiment-analysis', {
        feedbackId: feedback.id,
        rating: ratingStr,
        comment: comment.trim().slice(0, 1000),
      }).catch(() => {});
    }

    return { feedback };
  });

  app.get('/api/v1/orders/:id/feedback', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;
    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.customerId !== user.customerId) {
      return reply.status(403).send({ error: 'Not your order' });
    }
    const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.orderId, parseInt(id))).limit(1);
    return { feedback: feedback || null };
  });

  app.get('/api/v1/admin/feedbacks', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };
    const allFeedback = await db.select().from(feedbacks)
      .orderBy(desc(feedbacks.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    const avgResult = await db.select({
      avg: sql<string>`COALESCE(AVG(rating::int)::text, '0')`,
    }).from(feedbacks);
    return { feedbacks: allFeedback, averageRating: parseFloat(avgResult[0].avg).toFixed(1), total: allFeedback.length };
  });
}
