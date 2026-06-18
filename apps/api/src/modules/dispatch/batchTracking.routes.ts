import { FastifyInstance } from 'fastify';
import { redis } from '../../utils/redis.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db/connection.js';
import { orders } from '../../db/schemas/order.js';
import { inArray } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'batch-tracking' });

const RIDER_LOCATION_PREFIX = 'rider:location:';

// In-memory cache to avoid repeated Redis SCAN calls (5s TTL)
let cachedLocations: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

/**
 * Shared helper: fetch all active rider locations from Redis.
 * Uses a 5-second in-memory cache to reduce Redis SCAN calls.
 */
async function getAllRiderLocations(): Promise<any[]> {
  const now = Date.now();
  if (cachedLocations !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedLocations;
  }

  const keys: string[] = [];
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, 'MATCH', `${RIDER_LOCATION_PREFIX}*`, 'COUNT', 100);
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== '0');

  const locations: any[] = [];
  if (keys.length > 0) {
    const values = await redis.mget(...keys);
    for (const raw of values) {
      if (raw) {
        try {
          locations.push(JSON.parse(raw));
        } catch { /* skip corrupt entries */ }
      }
    }
  }

  cachedLocations = locations;
  cacheTimestamp = now;
  return locations;
}

/**
 * Batch Tracking Routes
 * 
 * Provides optimized endpoints for fetching multiple rider locations
 * and order status in a single API call.
 * 
 * - GET /api/v1/admin/tracking/batch — All active riders with order details
 * - GET /api/v1/admin/tracking/summary — Quick stats for dashboard
 */
export async function batchTrackingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  /**
   * Get all active rider locations with order details
   * Optimized for the admin batch tracking view
   */
  app.get('/api/v1/admin/tracking/batch', async (_request, reply) => {
    try {
      const locations = await getAllRiderLocations();

      // Get order details for each location
      const orderIds = locations.map(l => l.orderId).filter((id): id is number => typeof id === 'number');
      let orderDetails: any[] = [];
      
      if (orderIds.length > 0) {
        const uniqueIds = [...new Set(orderIds)];
        orderDetails = await db
          .select()
          .from(orders)
          .where(inArray(orders.id, uniqueIds));
      }

      // Merge location data with order details
      const enrichedLocations = locations.map(loc => {
        const order = orderDetails.find(o => o.id === loc.orderId);
        return {
          ...loc,
          orderStatus: order?.status,
          totalAmount: order?.totalAmount,
          createdAt: order?.createdAt,
        };
      });

      return { 
        riders: enrichedLocations, 
        count: enrichedLocations.length,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[BatchTracking] Failed to fetch batch locations');
      return reply.status(500).send({ error: `Failed to fetch batch locations: ${err.message}` });
    }
  });

  /**
   * Get quick stats for the admin dashboard
   */
  app.get('/api/v1/admin/tracking/summary', async (_request, reply) => {
    try {
      const locations = await getAllRiderLocations();

      // Calculate stats
      const activeRiders = locations.length;
      const avgEta = activeRiders > 0 
        ? Math.round(locations.reduce((sum, l) => sum + (l.eta || 0), 0) / activeRiders)
        : 0;
      const avgSpeed = activeRiders > 0
        ? Math.round(locations.reduce((sum, l) => sum + (l.speed || 0), 0) / activeRiders)
        : 0;

      // Get unique rider count (some riders might be tracking multiple orders)
      const uniqueRiders = new Set(locations.map(l => l.riderId)).size;

      return {
        activeOrders: activeRiders,
        activeRiders: uniqueRiders,
        avgEta,
        avgSpeed,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[BatchTracking] Failed to fetch summary');
      return reply.status(500).send({ error: err.message });
    }
  });
}
