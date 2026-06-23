import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { redis } from '../../utils/redis.js';
import { auditLog, diffChanges } from '../../utils/audit.js';
import { seedProductionData } from './productionSeed.js';

const CONFIG_KEY = 'admin:config';
const DEFAULT_CONFIG: Record<string, string> = {
  restaurantName: "The Katanguri's Kitchen",
  restaurantPhone: '+919347968582',
  restaurantEmail: 'hello@thekatanguriskitchen.com',
  restaurantAddress: 'Hunter Road, Tiger Hills Colony',
  restaurantCity: 'Hanamkonda, Warangal',
  restaurantPincode: '506001',
  restaurantLat: '17.9784',
  restaurantLng: '79.5941',
  opensAt: '12:00',
  closesAt: '22:00',
  webhookSecret: '',
  defaultDeliveryFee: '40',
  defaultMinOrder: '150',
  defaultRadiusKm: '5',
  freeDeliveryThreshold: '500',
};

async function loadConfig(): Promise<Record<string, string>> {
  try {
    const raw = await redis.get(CONFIG_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(config: Record<string, string>): Promise<void> {
  await redis.set(CONFIG_KEY, JSON.stringify(config));
}

export async function configRoutes(app: FastifyInstance) {
  // ── PUBLIC: Restaurant config (no auth required) ──
  app.get('/api/v1/config/restaurant', async (_request, reply) => {
    try {
      const { queryClient } = await import('../../db/connection.js');
      const rows = await queryClient`SELECT key, value FROM restaurant_config`;
      const config: Record<string, any> = {};
      for (const row of rows) {
        config[row.key] = row.value;
      }
      if (Object.keys(config).length === 0) {
        return reply.send({ ...DEFAULT_CONFIG });
      }
      return reply.send(config);
    } catch {
      return reply.send(DEFAULT_CONFIG);
    }
  });

  // ── ADMIN: Seed production data (auth + admin required) ──
  app.post('/api/v1/admin/seed-production', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    try {
      const result = await seedProductionData();
      await auditLog({
        entityType: 'config',
        entityId: 1,
        action: 'update',
        changes: { seeded: true, summary: result.summary },
        ctx: { userId: request.user?.customerId, userRole: request.user?.role },
      });
      return reply.send({ success: true, summary: result.summary });
    } catch (err: any) {
      request.log.error({ err: err.message }, '[Seed] Production seed failed');
      return reply.status(500).send({ error: 'Seed failed', details: err.message });
    }
  });

  // ── ADMIN: Config CRUD (auth + admin required) ──
  app.get('/api/v1/admin/config', { preHandler: [authenticate, requireAdmin] }, async () => {
    const cfg = await loadConfig();
    const { webhookSecret: _excluded, ...safeConfig } = cfg;
    return { config: safeConfig };
  });

  async function handleConfigUpdate(request: any) {
    const body = request.body as Record<string, string>;
    const current = await loadConfig();
    
    const protectedFields = ['webhookSecret'];
    const sanitizedBody = { ...body };
    for (const field of protectedFields) {
      if (field in sanitizedBody) {
        delete sanitizedBody[field];
      }
    }
    
    const updated = { ...current, ...sanitizedBody };
    await saveConfig(updated);
    await auditLog({
      entityType: 'config',
      entityId: 1,
      action: 'update',
      changes: diffChanges(current, updated, Object.keys(sanitizedBody)),
      ctx: { userId: request.user?.customerId, userRole: request.user?.role },
    });
    return { config: updated, message: 'Config saved' };
  }

  app.put('/api/v1/admin/config', { preHandler: [authenticate, requireAdmin] }, handleConfigUpdate);
  app.patch('/api/v1/admin/config', { preHandler: [authenticate, requireAdmin] }, handleConfigUpdate);
}
