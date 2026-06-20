import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { createDispatchAdapter } from './adapters/index.js';
import type { DispatchOrderRequest } from './adapters/index.js';
import { db } from '../../db/connection.js';
import { orders } from '../../db/schemas/order.js';
import { eq } from 'drizzle-orm';
import { publishEvent } from '../../utils/eventBus.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'dispatch-adapter-routes' });

/**
 * Dispatch Adapter Routes
 * 
 * Provides a unified API for dispatch operations regardless of which
 * provider is configured (dunzo, porter, shadowfax).
 * 
 * - POST /api/v1/admin/dispatch/create   — Create a dispatch order
 * - GET  /api/v1/admin/dispatch/:id/track — Track a dispatch order
 * - POST /api/v1/admin/dispatch/:id/cancel — Cancel a dispatch order
 * - GET  /api/v1/admin/dispatch/riders     — Get available riders
 * - GET  /api/v1/admin/dispatch/provider   — Get current provider info
 */
export async function dispatchAdapterRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  // Get current dispatch provider info
  app.get('/api/v1/admin/dispatch/provider', async (_request, reply) => {
    try {
      const providerName = process.env.DISPATCH_PROVIDER || '';
      if (!providerName) {
        return {
          provider: 'none',
          configured: '',
          status: 'not_configured',
          env: {
            DISPATCH_PROVIDER: '(not set)',
            DISPATCH_API_URL: process.env.DISPATCH_API_URL ? '✓ Set' : '✗ Not set',
            DUNZO_API_KEY: process.env.DUNZO_API_KEY ? '✓ Set' : '✗ Not set',
            PORTER_API_KEY: process.env.PORTER_API_KEY ? '✓ Set' : '✗ Not set',
            SHADOWFAX_API_KEY: process.env.SHADOWFAX_API_KEY ? '✓ Set' : '✗ Not set',
          },
        };
      }
      const adapter = createDispatchAdapter();
      return {
        provider: adapter.provider,
        configured: providerName,
        env: {
          DISPATCH_PROVIDER: process.env.DISPATCH_PROVIDER || '(not set)',
          DISPATCH_API_URL: process.env.DISPATCH_API_URL ? '✓ Set' : '✗ Not set',
          DUNZO_API_KEY: process.env.DUNZO_API_KEY ? '✓ Set' : '✗ Not set',
          PORTER_API_KEY: process.env.PORTER_API_KEY ? '✓ Set' : '✗ Not set',
          SHADOWFAX_API_KEY: process.env.SHADOWFAX_API_KEY ? '✓ Set' : '✗ Not set',
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Create a dispatch order
  app.post('/api/v1/admin/dispatch/create', async (request, reply) => {
    const body = request.body as Partial<DispatchOrderRequest>;
    if (!body.orderId) {
      return reply.status(400).send({ error: 'orderId is required' });
    }

    const adapter = createDispatchAdapter();

    try {
      // Get order details
      const [order] = await db.select().from(orders).where(eq(orders.id, body.orderId)).limit(1);
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      if (order.status !== 'READY') {
        return reply.status(400).send({ error: `Order must be in READY status (current: ${order.status})` });
      }

      // Default kitchen coordinates
      const kitchenLat = 17.9784;
      const kitchenLng = 79.5941;

      const dispatchRequest: DispatchOrderRequest = {
        orderId: body.orderId,
        pickup: body.pickup || { lat: kitchenLat, lng: kitchenLng, address: 'The Katanguri\'s Kitchen, Hanamkonda' },
        dropoff: body.dropoff || { lat: kitchenLat + 0.01, lng: kitchenLng + 0.01 },
        items: body.items || [{ name: `Order #${body.orderId}`, quantity: 1 }],
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        notes: body.notes,
      };

      const result = await adapter.createOrder(dispatchRequest);

      if (result.status === 'assigned') {
        // Update order status
        await db.update(orders)
          .set({ status: 'OUT_FOR_DELIVERY', dispatchId: result.dispatchId, updatedAt: new Date() })
          .where(eq(orders.id, body.orderId));

        await publishEvent('order.out_for_delivery', {
          orderId: body.orderId,
          dispatchId: result.dispatchId,
          riderName: result.riderName,
          riderPhone: result.riderPhone,
          riderEta: result.etaMinutes,
          provider: result.provider,
        });

        return {
          success: true,
          dispatch: result,
          message: `Order dispatched via ${result.provider}`,
        };
      }

      return reply.status(503).send({
        success: false,
        error: 'Failed to assign rider',
        dispatch: result,
      });
    } catch (err: any) {
      log.error({ err: err.message, orderId: body.orderId }, '[Dispatch] Create failed');
      return reply.status(500).send({ error: err.message });
    }
  });

  // Track a dispatch order
  app.get('/api/v1/admin/dispatch/:id/track', async (request, reply) => {
    const { id } = request.params as { id: string };
    const adapter = createDispatchAdapter();

    try {
      const tracking = await adapter.trackOrder(id);
      return { tracking };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Cancel a dispatch order
  app.post('/api/v1/admin/dispatch/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adapter = createDispatchAdapter();

    try {
      const result = await adapter.cancelOrder(id, reason);
      return { result };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get available riders
  app.get('/api/v1/admin/dispatch/riders', async (request, reply) => {
    const { lat, lng, radiusKm } = request.query as { lat?: string; lng?: string; radiusKm?: string };
    const adapter = createDispatchAdapter();

    try {
      const riders = await adapter.getAvailableRiders(
        { lat: lat ? parseFloat(lat) : 17.9784, lng: lng ? parseFloat(lng) : 79.5941 },
        radiusKm ? parseFloat(radiusKm) : 5,
      );
      return { riders, provider: adapter.provider };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
