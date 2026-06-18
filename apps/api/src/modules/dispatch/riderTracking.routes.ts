import { FastifyInstance } from 'fastify';
import * as jose from 'jose';
import { redis } from '../../utils/redis.js';
import { authenticate } from '../../middleware/auth.js';

import { pubSub } from '../../utils/redis.js';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/connection.js';
import { orders } from '../../db/schemas/order.js';
import { eq } from 'drizzle-orm';

const log = logger.child({ module: 'rider-tracking' });

const JWT_SECRET = process.env.JWT_SECRET || '';
const ACCESS_SECRET = new TextEncoder().encode(JWT_SECRET);

const RIDER_LOCATION_PREFIX = 'rider:location:';
const RIDER_LOCATION_TTL = 300; // 5 minutes — locations expire if rider stops reporting
const RIDER_CHANNEL_PREFIX = 'kitchen:event:rider.location:';

export interface RiderLocation {
  orderId: number;
  riderId: string;
  riderName: string;
  riderPhone?: string;
  lat: number;
  lng: number;
  heading?: number; // 0-360 degrees for direction arrow
  speed?: number;   // km/h
  eta?: number;     // minutes remaining
  updatedAt: string;
}

/**
 * Save rider location to Redis and broadcast to SSE clients.
 */
export async function updateRiderLocation(location: RiderLocation): Promise<void> {
  const key = `${RIDER_LOCATION_PREFIX}${location.orderId}`;
  const payload = JSON.stringify(location);

  try {
    await redis.set(key, payload, 'EX', RIDER_LOCATION_TTL);
    // Broadcast to subscribers watching this order's rider
    await pubSub.publish(`${RIDER_CHANNEL_PREFIX}${location.orderId}`, payload);
  } catch (err: any) {
    log.warn({ err: err.message }, '[RiderTracking] Failed to save location');
  }
}

/**
 * Get current rider location for an order.
 */
export async function getRiderLocation(orderId: number): Promise<RiderLocation | null> {
  try {
    const raw = await redis.get(`${RIDER_LOCATION_PREFIX}${orderId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Rider location tracking routes.
 * - POST /api/v1/rider/location — rider reports their position (called by dispatch aggregator or rider app)
 * - GET  /api/v1/orders/:id/rider-location — customer fetches current rider position
 * - GET  /api/v1/orders/:id/rider-stream — SSE stream for real-time rider position
 */
export async function riderTrackingRoutes(app: FastifyInstance) {

  // ── Rider reports location (authenticated, typically from dispatch system) ──
  app.post('/api/v1/rider/location', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as Partial<RiderLocation>;
    if (!body.orderId || body.lat == null || body.lng == null) {
      return reply.status(400).send({ error: 'orderId, lat, and lng are required' });
    }

    const location: RiderLocation = {
      orderId: body.orderId,
      riderId: body.riderId || 'unknown',
      riderName: body.riderName || 'Delivery Partner',
      riderPhone: body.riderPhone,
      lat: body.lat,
      lng: body.lng,
      heading: body.heading,
      speed: body.speed,
      eta: body.eta,
      updatedAt: new Date().toISOString(),
    };

    await updateRiderLocation(location);
    return { success: true };
  });

  // ── Customer fetches current rider position ──
  app.get('/api/v1/orders/:id/rider-location', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const orderId = parseInt(id);

    const location = await getRiderLocation(orderId);
    if (!location) {
      return { location: null, message: 'Rider location not yet available' };
    }

    return { location };
  });

  // ── SSE stream for real-time rider position updates ──
  app.get('/api/v1/orders/:id/rider-stream', async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const orderId = parseInt(id);

    // Authenticate — extract token from header or cookie
    const token = request.headers.authorization?.replace('Bearer ', '') || request.cookies?.access_token;
    if (!token) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    let user: any = null;
    try {
      const { payload } = await jose.jwtVerify(token, ACCESS_SECRET, { algorithms: ['HS256'] });
      user = payload;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Verify order ownership
    const [order] = await db.select({ customerId: orders.customerId })
      .from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.customerId && user.customerId !== order.customerId && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeData = (data: string) => {
      try { reply.raw.write(data); } catch { /* client disconnected */ }
    };

    // Send current location immediately
    const current = await getRiderLocation(orderId);
    if (current) {
      writeData(`data: ${JSON.stringify({ type: 'location', payload: current })}\n\n`);
    }

    writeData(`:connected\n\n`);

    // Subscribe to Redis channel for this order's rider updates
    const channel = `${RIDER_CHANNEL_PREFIX}${orderId}`;
    const sub = redis.duplicate();
    sub.subscribe(channel).catch(() => {});

    sub.on('message', (_ch, message) => {
      writeData(`data: ${JSON.stringify({ type: 'location', payload: JSON.parse(message) })}\n\n`);
    });

    // Heartbeat every 10s to keep connection alive
    const heartbeat = setInterval(() => {
      writeData(`:heartbeat\n\n`);
    }, 10000);

    // Cleanup on client disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      sub.unsubscribe(channel).catch(() => {});
      sub.disconnect();
    });
  });
}
