import { FastifyInstance } from 'fastify';
import { redis } from '../../utils/redis.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { RiderLocation } from './riderTracking.routes.js';
import { startRiderSimulation, stopRiderSimulation, getActiveSimulations } from './riderSimulator.js';
import { db } from '../../db/connection.js';
import { orders } from '../../db/schemas/order.js';
import { eq } from 'drizzle-orm';

const RIDER_LOCATION_PREFIX = 'rider:location:';

/**
 * Admin rider tracking routes.
 * - GET  /api/v1/admin/riders/locations  — all active rider locations
 * - GET  /api/v1/admin/riders/simulations — active simulations
 * - POST /api/v1/admin/riders/:orderId/simulate — start simulation for an order
 * - POST /api/v1/admin/riders/:orderId/stop — stop simulation for an order
 */
export async function riderAdminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  // Fetch all active rider locations (scans Redis keys with rider:location: prefix)
  app.get('/api/v1/admin/riders/locations', async (_request, reply) => {
    try {
      // Scan for all rider:location:* keys
      const keys: string[] = [];
      let cursor = '0';
      do {
        const result = await redis.scan(cursor, 'MATCH', `${RIDER_LOCATION_PREFIX}*`, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      const locations: RiderLocation[] = [];
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

      return { locations, count: locations.length };
    } catch (err: any) {
      return reply.status(500).send({ error: `Failed to fetch rider locations: ${err.message}` });
    }
  });

  // Get active simulations
  app.get('/api/v1/admin/riders/simulations', async (_request) => {
    return { simulations: getActiveSimulations() };
  });

  // Start a rider simulation for a specific order
  app.post('/api/v1/admin/riders/:orderId/simulate', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const id = parseInt(orderId);

    if (isNaN(id)) {
      return reply.status(400).send({ error: 'Invalid order ID' });
    }

    try {
      await startRiderSimulation(id);
      return { success: true, message: `Simulation started for order #${id}` };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Stop a rider simulation
  app.post('/api/v1/admin/riders/:orderId/stop', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const id = parseInt(orderId);

    if (isNaN(id)) {
      return reply.status(400).send({ error: 'Invalid order ID' });
    }

    stopRiderSimulation(id);
    return { success: true, message: `Simulation stopped for order #${id}` };
  });

  // Start simulations for all OUT_FOR_DELIVERY orders (bulk demo mode)
  app.post('/api/v1/admin/riders/simulate-all', async (_request, reply) => {
    try {
      const activeOrders = await db.select().from(orders).where(eq(orders.status, 'OUT_FOR_DELIVERY'));
      let started = 0;
      for (const order of activeOrders) {
        await startRiderSimulation(order.id);
        started++;
      }
      return { success: true, message: `Started ${started} rider simulations` };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
