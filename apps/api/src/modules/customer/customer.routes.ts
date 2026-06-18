import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { customers, customerAddresses } from '../../db/schemas/customer.js';
import { eq, desc } from 'drizzle-orm';
import { redis } from '../../utils/redis.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { createAddressSchema, updateProfileSchema } from '../../lib/validation.js';

const CUSTOMER_PROFILE_CACHE_TTL = 30;
const CUSTOMER_ADDRESSES_CACHE_TTL = 30;

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/api/v1/customer/profile', async (request) => {
    const user = request.user;
    const cacheKey = `cache:customer:profile:${user.customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const [customer] = await db.select({
      id: customers.id, name: customers.name, email: customers.email,
      phone: customers.phone, marketingOptOut: customers.marketingOptOut,
      createdAt: customers.createdAt, role: customers.role,
    }).from(customers).where(eq(customers.id, user.customerId)).limit(1);
    const result = { customer };
    await redis.setex(cacheKey, CUSTOMER_PROFILE_CACHE_TTL, JSON.stringify(result));
    return result;
  });

  app.patch('/api/v1/customer/profile', async (request, reply) => {
    const user = request.user;
    const body = await validateBody(request, reply, updateProfileSchema);
    if (body === null) return;
    const sanitized: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) sanitized.name = body.name;
    if (body.email !== undefined) sanitized.email = body.email;
    if (body.phone !== undefined) sanitized.phone = body.phone;
    const [updated] = await db.update(customers)
      .set(sanitized)
      .where(eq(customers.id, user.customerId))
      .returning();
    await redis.del(`cache:customer:profile:${user.customerId}`);
    return updated;
  });

  app.get('/api/v1/customer/addresses', async (request) => {
    const user = request.user;
    const cacheKey = `cache:customer:addresses:${user.customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const addresses = await db.select({
      id: customerAddresses.id, label: customerAddresses.label,
      addressLine1: customerAddresses.addressLine1, addressLine2: customerAddresses.addressLine2,
      city: customerAddresses.city, state: customerAddresses.state,
      pincode: customerAddresses.pincode, latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude, isDefault: customerAddresses.isDefault,
    }).from(customerAddresses).where(eq(customerAddresses.customerId, user.customerId));
    const result = { addresses };
    await redis.setex(cacheKey, CUSTOMER_ADDRESSES_CACHE_TTL, JSON.stringify(result));
    return result;
  });

  app.post('/api/v1/customer/addresses', async (request, reply) => {
    const user = request.user;
    const body = await validateBody(request, reply, createAddressSchema);
    if (body === null) return;

    let lat = body.latitude;
    let lng = body.longitude;
    if (lat == null || lng == null) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.006 + Math.random() * 0.006;
      lat = Number((17.9784 + Math.sin(angle) * radius).toFixed(7));
      lng = Number((79.5941 + Math.cos(angle) * radius).toFixed(7));
    }

    const [address] = await db.insert(customerAddresses).values({
      customerId: user.customerId,
      label: body.label || 'Home',
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      latitude: lat.toString(),
      longitude: lng.toString(),
      isDefault: body.isDefault || false,
    }).returning();
    return { address };
  });

  // Admin routes (require admin role)
  app.get('/api/v1/admin/customers', { preHandler: [requireAdmin] }, async (request) => {
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };
    const result = await db.select().from(customers)
      .orderBy(desc(customers.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    return { customers: result, total: result.length };
  });
}
