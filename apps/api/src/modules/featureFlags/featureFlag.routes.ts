import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import {
  getAllFeatureFlags, getFeatureFlag, setFeatureFlag, deleteFeatureFlag, isFeatureEnabled,
} from '../../lib/featureFlags.js';

export async function featureFlagRoutes(app: FastifyInstance) {
  // ── Public: check a flag (for client-side rendering) ──
  app.get('/api/v1/feature-flags/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const flag = await getFeatureFlag(key);
    if (!flag) return reply.status(404).send({ error: 'Flag not found' });

    const user = (request as any).user;
    const enabled = await isFeatureEnabled(key, {
      customerId: user?.customerId,
      role: user?.role,
    });

    return { key, enabled, rolloutPercentage: flag.rolloutPercentage };
  });

  // ── Admin: list all flags ──
  app.get('/api/v1/admin/feature-flags', { preHandler: [authenticate, requireAdmin] }, async () => {
    const flags = await getAllFeatureFlags();
    return { flags };
  });

  // ── Admin: get a single flag ──
  app.get('/api/v1/admin/feature-flags/:key', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const flag = await getFeatureFlag(key);
    if (!flag) return reply.status(404).send({ error: 'Flag not found' });
    return { flag };
  });

  // ── Admin: create/update a flag ──
  app.put('/api/v1/admin/feature-flags/:key', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { key } = request.params as { key: string };
    const body = request.body as Record<string, any>;
    const flag = await setFeatureFlag(key, body);
    return { flag };
  });

  // ── Admin: delete a flag ──
  app.delete('/api/v1/admin/feature-flags/:key', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { key } = request.params as { key: string };
    await deleteFeatureFlag(key);
    return { success: true };
  });

  // ── Admin: bulk check flags for a user ──
  app.post('/api/v1/admin/feature-flags/check', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { customerId, role } = request.body as { customerId?: number; role?: string };
    const flags = await getAllFeatureFlags();
    const results: Record<string, boolean> = {};
    for (const flag of flags) {
      results[flag.key] = await isFeatureEnabled(flag.key, { customerId, role });
    }
    return { results };
  });
}
