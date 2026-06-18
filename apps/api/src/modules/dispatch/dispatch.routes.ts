import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { orders } from '../../db/schemas/order.js';
import { eq, and, sql } from 'drizzle-orm';
import { publishEvent } from '../../utils/eventBus.js';
import { orderStatusHistory } from '../../db/schemas/order.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { assignDispatchSchema, confirmDeliverySchema } from '../../lib/validation.js';
import { KITCHEN_LAT, KITCHEN_LNG } from '../../lib/constants.js';

const DISPATCH_API_URL = process.env.DISPATCH_API_URL || '';
const DISPATCH_API_KEY = process.env.DISPATCH_API_KEY || '';

interface Rider {
  id: string;
  name: string;
  phone: string;
  eta: number;
  rating: number;
  active_orders: number;
  lat: number;
  lng: number;
}

async function findAvailableRiders(_orderId: number, pickupLat: number, pickupLng: number): Promise<Rider[]> {
  if (DISPATCH_API_URL && DISPATCH_API_KEY && DISPATCH_API_KEY !== 'CHANGE_ME') {
    try {
      const response = await fetch(`${DISPATCH_API_URL}/riders/available`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DISPATCH_API_KEY}`,
        },
        body: JSON.stringify({
          pickup: { lat: pickupLat, lng: pickupLng },
          radius_km: 3,
          limit: 10,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as any;
        return (data.riders || []).map((r: any) => ({
          id: r.id || r.rider_id,
          name: r.name || r.rider_name,
          phone: r.phone || r.mobile,
          eta: r.eta_minutes || 15,
          rating: r.rating || 4.0,
          active_orders: r.active_orders || 0,
          lat: r.lat || pickupLat,
          lng: r.lng || pickupLng,
        }));
      }
    } catch {
      return [];
    }
  }

  return [];
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPeakHour(): boolean {
  const hour = new Date().getHours();
  return (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 22);
}

function selectBestRider(riders: Rider[], orderLat: number, orderLng: number): Rider | null {
  if (riders.length === 0) return null;

  const peakMultiplier = isPeakHour() ? 1.5 : 1.0;

  return riders
    .map((rider) => {
      const distance = haversineDistance(rider.lat, rider.lng, orderLat, orderLng);
      const distanceScore = distance * 0.3;
      const etaScore = rider.eta * 0.25;
      const ratingScore = (5 - rider.rating) * 15;
      const loadScore = rider.active_orders * 5 * peakMultiplier;
      const capacityUtil = rider.active_orders >= 3 ? 20 : 0;

      const totalScore = distanceScore + etaScore + ratingScore + loadScore + capacityUtil;
      return { rider, score: totalScore };
    })
    .sort((a, b) => a.score - b.score)[0]?.rider || null;
}

export async function dispatchRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  app.post('/api/v1/admin/dispatch/assign', async (request, reply) => {
    const body = await validateBody(request, reply, assignDispatchSchema);
    if (body === null) return;
    const { orderId } = body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.status !== 'READY') {
      return reply.status(400).send({ error: 'Order must be in READY status to dispatch' });
    }

    const riders = await findAvailableRiders(orderId, KITCHEN_LAT, KITCHEN_LNG);
    const bestRider = selectBestRider(riders, KITCHEN_LAT, KITCHEN_LNG);

    if (!bestRider) {
      // Use BullMQ delayed job for escalation instead of setTimeout (survives restarts)
      try {
        const { orderQueue } = await import('../../utils/queue.js');
        await orderQueue.add('dispatch-escalation', { orderId, type: 'rider_unavailable' }, {
          delay: 3 * 60 * 1000,
          jobId: `escalation_${orderId}`,
          removeOnComplete: true,
        });
      } catch {
        // Fallback to event publishing if queue unavailable
        await publishEvent('admin.alert', {
          type: 'rider_unavailable',
          orderId,
          message: `No rider found for order #${orderId}`,
        });
      }

      return reply.status(503).send({
        error: 'No rider available',
        fallback: 'manual',
        message: 'No rider found. The KDS will show a QR code for walk-in riders.',
      });
    }

    const dispatchId = `DISPATCH_${orderId}_${Date.now()}`;
    await db.transaction(async (tx) => {
      const [u] = await tx.update(orders)
        .set({ status: 'OUT_FOR_DELIVERY', dispatchId, updatedAt: new Date(), version: sql`${orders.version} + 1` })
        .where(and(eq(orders.id, orderId), eq(orders.version, order.version), eq(orders.status, 'READY')))
        .returning();

      if (!u) {
        throw new Error('Order was modified concurrently or is no longer in READY status');
      }

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: 'READY',
        toStatus: 'OUT_FOR_DELIVERY',
        changedBy: `dispatch_auto:${bestRider.id}`,
      });
    });

    await publishEvent('order.out_for_delivery', {
      orderId,
      dispatchId,
      riderName: bestRider.name,
      riderPhone: bestRider.phone,
      riderEta: bestRider.eta,
    });

    return {
      dispatchId,
      status: 'OUT_FOR_DELIVERY',
      rider: { name: bestRider.name, phone: bestRider.phone, eta: bestRider.eta },
      message: 'Rider assigned',
    };
  });

  app.post('/api/v1/admin/dispatch/confirm-delivery', async (request, reply) => {
    const body = await validateBody(request, reply, confirmDeliverySchema);
    if (body === null) return;
    const { orderId } = body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status !== 'OUT_FOR_DELIVERY') {
      return reply.status(400).send({ error: 'Order must be in OUT_FOR_DELIVERY status to confirm delivery' });
    }

    const [u] = await db.update(orders)
      .set({ status: 'DELIVERED', updatedAt: new Date(), version: sql`${orders.version} + 1` })
      .where(and(eq(orders.id, orderId), eq(orders.version, order.version), eq(orders.status, 'OUT_FOR_DELIVERY')))
      .returning();

    if (!u) {
      return reply.status(409).send({ error: 'Order was modified concurrently or is no longer out for delivery' });
    }

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'OUT_FOR_DELIVERY',
      toStatus: 'DELIVERED',
      changedBy: 'dispatch_automation',
    });
    await publishEvent('order.delivered', { orderId });

    return { status: 'DELIVERED' };
  });
}
