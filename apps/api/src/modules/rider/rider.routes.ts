import { FastifyInstance } from 'fastify';
import { randomInt } from 'crypto';
import { db } from '../../db/connection.js';
import { riders, riderEarnings } from '../../db/schemas/rider.js';
import { orders, orderStatusHistory } from '../../db/schemas/order.js';
import { eq, and, sql } from 'drizzle-orm';
import { redis } from '../../utils/redis.js';
import { publishEvent } from '../../utils/eventBus.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { generateTokenPair } from '../../lib/refreshToken.js';
import { sendSMS } from '../../services/sms.service.js';
import { safeCompare } from '../../lib/safeCompare.js';
import { riderRegisterSchema, riderLoginSchema, riderLocationSchema, riderStatusSchema, riderSendOtpSchema } from '../../lib/validation.js';
import { OTP_EXPIRY_SECONDS, OTP_PREFIX, OTP_RATE_LIMIT, RIDER_EARNING_PER_DELIVERY, KITCHEN_LAT, KITCHEN_LNG } from '../../lib/constants.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'rider' });

function generateOTP(): string {
  return String(randomInt(100000, 1000000));
}

async function sendOTP(phone: string, otp: string): Promise<void> {
  try {
    await sendSMS(phone, `Your Katanguri's Kitchen rider OTP is ${otp}. Valid for 5 minutes.`);
  } catch {
    // OTP stored in Redis regardless of SMS delivery
  }
}

async function storeOTP(phone: string, otp: string): Promise<void> {
  const data = JSON.stringify({ otp, expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000 });
  await redis.set(`${OTP_PREFIX}rider:${phone}`, data, 'EX', OTP_EXPIRY_SECONDS);
}

async function getOTP(phone: string): Promise<{ otp: string; expiresAt: number } | null> {
  const data = await redis.get(`${OTP_PREFIX}rider:${phone}`);
  return data ? JSON.parse(data) : null;
}

async function deleteOTP(phone: string): Promise<void> {
  await redis.del(`${OTP_PREFIX}rider:${phone}`);
}

async function checkRateLimit(phone: string): Promise<boolean> {
  const key = `rate:rider_otp:${phone}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, 900);
  return current <= OTP_RATE_LIMIT;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function riderRoutes(app: FastifyInstance) {
  // ── Send OTP for rider login ──
  app.post('/api/v1/rider/send-otp', async (request, reply) => {
    const body = await validateBody(request, reply, riderSendOtpSchema);
    if (body === null) return;
    const { phone } = body;

    if (!(await checkRateLimit(phone))) {
      return reply.status(429).send({ error: 'Too many OTP requests. Try again in 15 minutes.' });
    }

    const otp = generateOTP();
    await storeOTP(phone, otp);
    await sendOTP(phone, otp);

    log.info({ phone }, '[Rider] OTP sent');
    return { message: 'OTP sent successfully' };
  });

  // ── Rider login with OTP ──
  app.post('/api/v1/rider/login', async (request, reply) => {
    const body = await validateBody(request, reply, riderLoginSchema);
    if (body === null) return;
    const { phone, otp } = body;

    const stored = await getOTP(phone);
    if (!stored || !safeCompare(stored.otp, otp)) {
      return reply.status(400).send({ error: 'Invalid or expired OTP' });
    }
    if (Date.now() > stored.expiresAt) {
      await deleteOTP(phone);
      return reply.status(400).send({ error: 'OTP has expired' });
    }
    await deleteOTP(phone);

    let [rider] = await db.select().from(riders).where(eq(riders.phone, phone)).limit(1);
    if (!rider) {
      return reply.status(404).send({ error: 'Rider not found. Please register first.' });
    }

    if (!rider.isActive) {
      return reply.status(403).send({ error: 'Rider account is deactivated. Contact admin.' });
    }

    rider = (await db.update(riders).set({ updatedAt: new Date() }).where(eq(riders.id, rider.id)).returning())[0];

    const tokens = await generateTokenPair(rider.id, 'rider');

    return {
      ...tokens,
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        vehicleType: rider.vehicleType,
        status: rider.status,
        rating: rider.rating,
        totalDeliveries: rider.totalDeliveries,
        totalEarnings: rider.totalEarnings,
        isVerified: rider.isVerified,
      },
    };
  });

  // ── Register new rider ──
  app.post('/api/v1/rider/register', async (request, reply) => {
    const body = await validateBody(request, reply, riderRegisterSchema);
    if (body === null) return;
    const { name, phone, vehicleType, vehicleNumber } = body;

    const existing = await db.select().from(riders).where(eq(riders.phone, phone)).limit(1);
    if (existing.length) {
      return reply.status(409).send({ error: 'Rider with this phone already exists' });
    }

    const [rider] = await db.insert(riders).values({
      name,
      phone,
      vehicleType: vehicleType || 'bike',
      vehicleNumber: vehicleNumber || null,
    }).returning();

    await publishEvent('rider.registered', { riderId: rider.id, name, phone });

    const otp = generateOTP();
    await storeOTP(phone, otp);
    await sendOTP(phone, otp);

    log.info({ riderId: rider.id, phone }, '[Rider] Registered');
    return {
      message: 'Rider registered successfully. OTP sent for login.',
      riderId: rider.id,
    };
  });

  // ── Get rider profile ──
  app.get('/api/v1/rider/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });

    const [rider] = await db.select().from(riders).where(eq(riders.id, user.customerId)).limit(1);
    if (!rider) return reply.status(404).send({ error: 'Rider not found' });

    return {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      email: rider.email,
      vehicleType: rider.vehicleType,
      vehicleNumber: rider.vehicleNumber,
      status: rider.status,
      isVerified: rider.isVerified,
      currentLat: rider.currentLat,
      currentLng: rider.currentLng,
      rating: rider.rating,
      totalDeliveries: rider.totalDeliveries,
      totalEarnings: rider.totalEarnings,
      currentOrderId: rider.currentOrderId,
      createdAt: rider.createdAt,
    };
  });

  // ── Toggle rider online/offline status ──
  app.put('/api/v1/rider/status', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });

    const body = await validateBody(request, reply, riderStatusSchema);
    if (body === null) return;

    const [rider] = await db.update(riders)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(riders.id, user.customerId))
      .returning();

    await publishEvent('rider.status_changed', { riderId: user.customerId, status: body.status });

    log.info({ riderId: user.customerId, status: body.status }, '[Rider] Status changed');
    return { status: rider.status };
  });

  // ── Update rider location ──
  app.put('/api/v1/rider/location', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });

    const body = await validateBody(request, reply, riderLocationSchema);
    if (body === null) return;

    await db.update(riders)
      .set({ currentLat: String(body.lat), currentLng: String(body.lng), updatedAt: new Date() })
      .where(eq(riders.id, user.customerId));

    await publishEvent('rider.location_updated', {
      riderId: user.customerId,
      lat: body.lat,
      lng: body.lng,
      timestamp: new Date().toISOString(),
    });

    return { message: 'Location updated' };
  });

  // ── Get available orders for rider ──
  app.get('/api/v1/rider/available-orders', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });

    const [rider] = await db.select().from(riders).where(eq(riders.id, user.customerId)).limit(1);
    if (!rider || rider.status !== 'online') {
      return reply.status(400).send({ error: 'You must be online to see available orders' });
    }
    if (rider.currentOrderId) {
      return reply.status(400).send({ error: 'You already have an active order. Complete it first.' });
    }

    const readyOrders = await db.select().from(orders)
      .where(and(eq(orders.status, 'READY'), sql`${orders.deliveryAddressId} IS NOT NULL`))
      .orderBy(orders.createdAt)
      .limit(10);

    const riderLat = rider.currentLat ? parseFloat(rider.currentLat.toString()) : KITCHEN_LAT;
    const riderLng = rider.currentLng ? parseFloat(rider.currentLng.toString()) : KITCHEN_LNG;

    const available = readyOrders.map((o) => {
      const distance = o.deliveryAddressId
        ? Math.random() * 5 + 1
        : haversineKm(riderLat, riderLng, KITCHEN_LAT, KITCHEN_LNG);
      return {
        orderId: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
        estimatedDistance: `${distance.toFixed(1)} km`,
        estimatedEarning: RIDER_EARNING_PER_DELIVERY,
        createdAt: o.createdAt,
      };
    });

    return { orders: available };
  });

  // ── Accept an order ──
  app.post('/api/v1/rider/accept-order/:orderId', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });
    const { orderId } = request.params as { orderId: string };

    const [rider] = await db.select().from(riders).where(eq(riders.id, user.customerId)).limit(1);
    if (!rider) return reply.status(404).send({ error: 'Rider not found' });
    if (rider.currentOrderId) {
      return reply.status(400).send({ error: 'You already have an active order' });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(orderId))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status !== 'READY') {
      return reply.status(400).send({ error: `Order is in ${order.status} status. Only READY orders can be accepted.` });
    }

    const dispatchId = `RIDER_${order.id}_${rider.id}_${Date.now()}`;

    const result = await db.transaction(async (tx) => {
      const [u] = await tx.update(orders)
        .set({ status: 'OUT_FOR_DELIVERY', dispatchId, updatedAt: new Date(), version: sql`${orders.version} + 1` })
        .where(and(eq(orders.id, order.id), eq(orders.version, order.version), eq(orders.status, 'READY')))
        .returning();

      if (!u) return null;

      await tx.update(riders)
        .set({ status: 'busy', currentOrderId: order.id, updatedAt: new Date() })
        .where(eq(riders.id, rider.id));

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'READY',
        toStatus: 'OUT_FOR_DELIVERY',
        changedBy: `rider_${rider.id}`,
        notes: `Assigned to rider ${rider.name} (${rider.phone})`,
      });

      return u;
    });

    if (!result) {
      return reply.status(409).send({ error: 'Order already accepted by another rider or is no longer READY' });
    }

    await publishEvent('order.out_for_delivery', {
      orderId: order.id,
      dispatchId,
      riderId: rider.id,
      riderName: rider.name,
      riderPhone: rider.phone,
      riderLat: rider.currentLat,
      riderLng: rider.currentLng,
    });

    log.info({ orderId: order.id, riderId: rider.id }, '[Rider] Accepted order');
    return {
      message: 'Order accepted',
      orderId: order.id,
      dispatchId,
      status: 'OUT_FOR_DELIVERY',
    };
  });

  // ── Mark order as picked up ──
  app.post('/api/v1/rider/picked-up/:orderId', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });
    const { orderId } = request.params as { orderId: string };

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(orderId))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status !== 'OUT_FOR_DELIVERY') {
      return reply.status(400).send({ error: 'Order must be OUT_FOR_DELIVERY to mark as picked up' });
    }

    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'OUT_FOR_DELIVERY',
      toStatus: 'OUT_FOR_DELIVERY',
      changedBy: `rider_${user.customerId}`,
      notes: 'Order picked up by rider',
    });

    await publishEvent('rider.picked_up', { orderId: order.id, riderId: user.customerId });

    return { message: 'Order picked up', orderId: order.id };
  });

  // ── Mark order as delivered ──
  app.post('/api/v1/rider/delivered/:orderId', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });
    const { orderId } = request.params as { orderId: string };

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(orderId))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status !== 'OUT_FOR_DELIVERY') {
      return reply.status(400).send({ error: 'Order must be OUT_FOR_DELIVERY to mark as delivered' });
    }
    if (!order.dispatchId || !order.dispatchId.includes(`RIDER_${user.customerId}_`)) {
      return reply.status(403).send({ error: 'Not authorized to complete this delivery' });
    }

    const [rider] = await db.select().from(riders).where(eq(riders.id, user.customerId)).limit(1);
    if (!rider) return reply.status(404).send({ error: 'Rider not found' });

    const earning = RIDER_EARNING_PER_DELIVERY;

    await db.transaction(async (tx) => {
      const [u] = await tx.update(orders)
        .set({ status: 'DELIVERED', updatedAt: new Date(), version: sql`${orders.version} + 1` })
        .where(and(eq(orders.id, order.id), eq(orders.version, order.version), eq(orders.status, 'OUT_FOR_DELIVERY')))
        .returning();

      if (!u) return;

      await tx.update(riders)
        .set({
          status: 'online',
          currentOrderId: null,
          totalDeliveries: sql`${riders.totalDeliveries} + 1`,
          totalEarnings: sql`${riders.totalEarnings} + ${earning}`,
          updatedAt: new Date(),
        })
        .where(eq(riders.id, rider.id));

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'OUT_FOR_DELIVERY',
        toStatus: 'DELIVERED',
        changedBy: `rider_${rider.id}`,
        notes: `Delivered by ${rider.name}`,
      });

      await tx.insert(riderEarnings).values({
        riderId: rider.id,
        orderId: order.id,
        amount: String(earning),
        type: 'delivery',
        status: 'completed',
      });
    });

    await publishEvent('order.delivered', {
      orderId: order.id,
      riderId: user.customerId,
      riderName: rider.name,
      earning,
    });

    log.info({ orderId: order.id, riderId: rider.id, earning }, '[Rider] Delivered order');
    return {
      message: 'Order delivered successfully',
      orderId: order.id,
      earning,
      totalEarnings: Number(rider.totalEarnings) + earning,
      totalDeliveries: Number(rider.totalDeliveries) + 1,
    };
  });

  // ── Get rider earnings ──
  app.get('/api/v1/rider/earnings', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });

    const [rider] = await db.select().from(riders).where(eq(riders.id, user.customerId)).limit(1);
    if (!rider) return reply.status(404).send({ error: 'Rider not found' });

    const recentEarnings = await db.select().from(riderEarnings)
      .where(eq(riderEarnings.riderId, rider.id))
      .orderBy(riderEarnings.createdAt)
      .limit(50);

    return {
      totalEarnings: rider.totalEarnings,
      totalDeliveries: rider.totalDeliveries,
      recentTransactions: recentEarnings.map((e) => ({
        id: e.id,
        orderId: e.orderId,
        amount: e.amount,
        type: e.type,
        status: e.status,
        createdAt: e.createdAt,
      })),
    };
  });

  // ── Get rider delivery history ──
  app.get('/api/v1/rider/history', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'rider') return reply.status(403).send({ error: 'Rider access required' });

    const riderOrders = await db.select().from(orders)
      .where(sql`${orders.dispatchId} LIKE ${`RIDER_${user.customerId}_%`}`)
      .orderBy(orders.updatedAt)
      .limit(50);

    return {
      deliveries: riderOrders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
      total: riderOrders.length,
    };
  });

  // ── Customer tracking: get rider location for an order ──
  app.get('/api/v1/orders/:id/track', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;
    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(id))).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (user.role !== 'admin' && user.role !== 'rider' && order.customerId !== user.customerId) {
      return reply.status(403).send({ error: 'Not your order' });
    }
    if (!order.dispatchId || !order.dispatchId.startsWith('RIDER_')) {
      return reply.status(400).send({ error: 'No rider assigned to this order yet' });
    }

    const riderId = parseInt(order.dispatchId.split('_')[2]);
    if (isNaN(riderId)) {
      return reply.status(400).send({ error: 'Invalid dispatch ID format' });
    }
    const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) {
      return reply.status(404).send({ error: 'Rider not found' });
    }

    reply.header('Cache-Control', 'no-cache');
    reply.header('X-Accel-Buffering', 'no');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendLocation = () => {
      const data = {
        riderName: rider.name,
        riderPhone: rider.phone,
        riderLat: rider.currentLat ? parseFloat(rider.currentLat.toString()) : null,
        riderLng: rider.currentLng ? parseFloat(rider.currentLng.toString()) : null,
        riderRating: rider.rating,
        orderStatus: order.status,
        estimatedDelivery: '10-15 min',
      };
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendLocation();
    const interval = setInterval(sendLocation, 5000);

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    });
  });

  // ── Admin: List all riders ──
  app.get('/api/v1/admin/riders', { preHandler: [authenticate] }, async (_request, reply) => {
    const user = (_request as any).user;
    if (user.role !== 'admin') return reply.status(403).send({ error: 'Admin access required' });

    const allRiders = await db.select().from(riders).orderBy(riders.createdAt);
    return {
      riders: allRiders.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        vehicleType: r.vehicleType,
        vehicleNumber: r.vehicleNumber,
        status: r.status,
        isVerified: r.isVerified,
        isActive: r.isActive,
        rating: r.rating,
        totalDeliveries: r.totalDeliveries,
        totalEarnings: r.totalEarnings,
        currentOrderId: r.currentOrderId,
        createdAt: r.createdAt,
      })),
      total: allRiders.length,
    };
  });

  // ── Admin: Verify rider ──
  app.put('/api/v1/admin/riders/:id/verify', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'admin') return reply.status(403).send({ error: 'Admin access required' });
    const { id } = request.params as { id: string };

    const [rider] = await db.update(riders)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(riders.id, parseInt(id)))
      .returning();

    if (!rider) return reply.status(404).send({ error: 'Rider not found' });

    await publishEvent('rider.verified', { riderId: rider.id, name: rider.name });

    log.info({ riderId: rider.id }, '[Rider] Verified by admin');
    return { message: 'Rider verified', riderId: rider.id, name: rider.name };
  });

  // ── Admin: Toggle rider active status ──
  app.put('/api/v1/admin/riders/:id/toggle-active', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'admin') return reply.status(403).send({ error: 'Admin access required' });
    const { id } = request.params as { id: string };

    const [rider] = await db.select().from(riders).where(eq(riders.id, parseInt(id))).limit(1);
    if (!rider) return reply.status(404).send({ error: 'Rider not found' });

    const [updated] = await db.update(riders)
      .set({ isActive: !rider.isActive, updatedAt: new Date() })
      .where(eq(riders.id, rider.id))
      .returning();

    await publishEvent('rider.toggled_active', { riderId: rider.id, isActive: updated.isActive });

    return { message: `Rider ${updated.isActive ? 'activated' : 'deactivated'}`, isActive: updated.isActive };
  });

  // ── SSE: Live rider location stream for a specific order (Redis pub/sub) ──
  app.get('/api/v1/rider/stream/:orderId', { preHandler: [authenticate] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };

    const [order] = await db.select().from(orders).where(eq(orders.id, parseInt(orderId))).limit(1);
    if (!order?.dispatchId?.startsWith('RIDER_')) {
      return reply.status(404).send({ error: 'No rider assigned' });
    }

    const riderId = parseInt(order.dispatchId.split('_')[2]);
    if (isNaN(riderId)) {
      return reply.status(400).send({ error: 'Invalid dispatch ID format' });
    }

    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Try cached rider location from Redis first
    let cachedLat: number | null = null;
    let cachedLng: number | null = null;
    let cachedName = '';
    let cachedPhone = '';
    let cachedRating = 0;
    let cachedVehicle = '';
    const cachedStatus = order.status;
    try {
      const cacheKey = `rider:location:${riderId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        cachedLat = parsed.lat;
        cachedLng = parsed.lng;
        cachedName = parsed.name || '';
        cachedPhone = parsed.phone || '';
        cachedRating = parsed.rating || 0;
        cachedVehicle = parsed.vehicleType || '';
      }
    } catch {
      // Redis unavailable
    }

    const sendUpdate = async () => {
      try {
        let lat = cachedLat;
        let lng = cachedLng;
        let name = cachedName;
        let phone = cachedPhone;
        let rating = cachedRating;
        let vehicle = cachedVehicle;
        let orderStatus = cachedStatus;

        try {
          const cacheKey = `rider:location:${riderId}`;
          const cached = await redis.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            lat = parsed.lat;
            lng = parsed.lng;
            name = parsed.name || name;
            phone = parsed.phone || phone;
            rating = parsed.rating || rating;
            vehicle = parsed.vehicleType || vehicle;
          }
          const orderCacheKey = `rider:order:status:${orderId}`;
          const orderCached = await redis.get(orderCacheKey);
          if (orderCached) {
            orderStatus = JSON.parse(orderCached).status;
          }
        } catch {
          // Redis unavailable — use last known values
        }

        const data = {
          riderId,
          riderName: name,
          riderPhone: phone,
          lat,
          lng,
          rating,
          vehicleType: vehicle,
          orderStatus,
          updatedAt: new Date().toISOString(),
        };
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        reply.raw.write(': error fetching location\n\n');
      }
    };

    // Subscribe to rider location updates via Redis pub/sub
    // Use a duplicate of subscriberRedis — NOT pubSub — to avoid putting the
    // shared pubSub connection into subscriber mode (which breaks eventBus.publish)
    const { subscriberRedis } = await import('../../utils/redis.js');
    const riderSub = subscriberRedis.duplicate();
    const locationChannel = `rider:location:updates:${riderId}`;
    try {
      await riderSub.subscribe(locationChannel);
    } catch {
      // Subscribe failure is non-fatal
    }
    const onMessage = (ch: string, message: string) => {
      if (ch !== locationChannel) return;
      try {
        const data = JSON.parse(message);
        cachedLat = data.lat;
        cachedLng = data.lng;
        const cacheKey = `rider:location:${riderId}`;
        redis.setex(cacheKey, 30, JSON.stringify({
          lat: data.lat, lng: data.lng, name: cachedName, phone: cachedPhone,
          rating: cachedRating, vehicleType: cachedVehicle,
        })).catch(() => {});
        const payload = { riderId: data.riderId, lat: data.lat, lng: data.lng, updatedAt: new Date().toISOString() };
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Parse failure
      }
    };
    riderSub.on('message', onMessage);

    // Initial state
    await sendUpdate();

    // Fallback polling every 30s instead of 5s
    const interval = setInterval(sendUpdate, 30000);
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15000);

    request.raw.on('close', () => {
      clearInterval(interval);
      clearInterval(heartbeat);
      try { riderSub.unsubscribe(locationChannel); } catch { /* ignore */ }
      riderSub.off('message', onMessage);
      riderSub.disconnect().catch(() => {});
    });
  });
}
