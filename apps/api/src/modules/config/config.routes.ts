import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { redis } from '../../utils/redis.js';
import { auditLog, diffChanges } from '../../utils/audit.js';

const CONFIG_KEY = 'admin:config';
const DEFAULT_CONFIG: Record<string, string> = {
  restaurantName: "The Katanguri's Kitchen",
  restaurantPhone: '+919876543210',
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
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  app.get('/api/v1/admin/config', async () => {
    const cfg = await loadConfig();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured to exclude from response
    const { webhookSecret: _excluded, ...safeConfig } = cfg;
    return { config: safeConfig };
  });

  async function handleConfigUpdate(request: any) {
    const body = request.body as Record<string, string>;
    const current = await loadConfig();
    
    // Prevent overwriting sensitive fields
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

  app.put('/api/v1/admin/config', handleConfigUpdate);
  app.patch('/api/v1/admin/config', handleConfigUpdate);
}
