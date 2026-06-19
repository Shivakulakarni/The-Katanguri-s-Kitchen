import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { customers, customerAddresses, customerFavorites } from '../../db/schemas/customer.js';
import { orders } from '../../db/schemas/order.js';
import { dishes } from '../../db/schemas/menu.js';
import { eq, desc, sql, count, and } from 'drizzle-orm';
import { redis } from '../../utils/redis.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { createAddressSchema, updateAddressSchema, updateProfileSchema, createFavoriteSchema } from '../../lib/validation.js';

const CUSTOMER_PROFILE_CACHE_TTL = 30;
const CUSTOMER_ADDRESSES_CACHE_TTL = 30;
const CUSTOMER_FAVORITES_CACHE_TTL = 60;
const CUSTOMER_STATS_CACHE_TTL = 120;

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

  // ── Update address ──
  app.patch('/api/v1/customer/addresses/:id', async (request, reply) => {
    const user = request.user;
    const addressId = parseInt((request.params as any).id);
    if (isNaN(addressId)) return reply.status(400).send({ error: 'Invalid address ID' });
    const body = await validateBody(request, reply, updateAddressSchema);
    if (body === null) return;
    const [existing] = await db.select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, user.customerId)));
    if (!existing) return reply.status(404).send({ error: 'Address not found' });
    const sanitized: Record<string, any> = {};
    if (body.label !== undefined) sanitized.label = body.label;
    if (body.addressLine1 !== undefined) sanitized.addressLine1 = body.addressLine1;
    if (body.addressLine2 !== undefined) sanitized.addressLine2 = body.addressLine2;
    if (body.city !== undefined) sanitized.city = body.city;
    if (body.state !== undefined) sanitized.state = body.state;
    if (body.pincode !== undefined) sanitized.pincode = body.pincode;
    if (body.latitude !== undefined) sanitized.latitude = body.latitude?.toString();
    if (body.longitude !== undefined) sanitized.longitude = body.longitude?.toString();
    if (body.isDefault !== undefined) {
      sanitized.isDefault = body.isDefault;
      if (body.isDefault) {
        await db.update(customerAddresses)
          .set({ isDefault: false })
          .where(and(eq(customerAddresses.customerId, user.customerId), sql`${customerAddresses.id} != ${addressId}`));
      }
    }
    const [updated] = await db.update(customerAddresses)
      .set(sanitized)
      .where(eq(customerAddresses.id, addressId))
      .returning();
    await redis.del(`cache:customer:addresses:${user.customerId}`);
    return { address: updated };
  });

  // ── Delete address ──
  app.delete('/api/v1/customer/addresses/:id', async (request, reply) => {
    const user = request.user;
    const addressId = parseInt((request.params as any).id);
    if (isNaN(addressId)) return reply.status(400).send({ error: 'Invalid address ID' });
    const [existing] = await db.select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, user.customerId)));
    if (!existing) return reply.status(404).send({ error: 'Address not found' });
    await db.delete(customerAddresses).where(eq(customerAddresses.id, addressId));
    await redis.del(`cache:customer:addresses:${user.customerId}`);
    return { success: true };
  });

  // ── Set default address ──
  app.post('/api/v1/customer/addresses/:id/default', async (request, reply) => {
    const user = request.user;
    const addressId = parseInt((request.params as any).id);
    if (isNaN(addressId)) return reply.status(400).send({ error: 'Invalid address ID' });
    const [existing] = await db.select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, user.customerId)));
    if (!existing) return reply.status(404).send({ error: 'Address not found' });
    await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, user.customerId));
    await db.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, addressId));
    await redis.del(`cache:customer:addresses:${user.customerId}`);
    return { success: true };
  });

  // ── Favorites CRUD ──

  // List favorites
  app.get('/api/v1/customer/favorites', async (request) => {
    const user = request.user;
    const cacheKey = `cache:customer:favorites:${user.customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const favs = await db.select({
      id: customerFavorites.id,
      dishId: customerFavorites.dishId,
      createdAt: customerFavorites.createdAt,
      dishName: dishes.name,
      dishPrice: dishes.price,
      dishImageUrl: dishes.imageUrl,
      dishIsVeg: dishes.isVeg,
      dishDescription: dishes.description,
    }).from(customerFavorites)
      .innerJoin(dishes, eq(customerFavorites.dishId, dishes.id))
      .where(eq(customerFavorites.customerId, user.customerId))
      .orderBy(desc(customerFavorites.createdAt));
    const result = { favorites: favs };
    await redis.setex(cacheKey, CUSTOMER_FAVORITES_CACHE_TTL, JSON.stringify(result));
    return result;
  });

  // Add favorite
  app.post('/api/v1/customer/favorites', async (request, reply) => {
    const user = request.user;
    const body = await validateBody(request, reply, createFavoriteSchema);
    if (body === null) return;
    const [dish] = await db.select({ id: dishes.id }).from(dishes).where(eq(dishes.id, body.dishId));
    if (!dish) return reply.status(404).send({ error: 'Dish not found' });
    const [existing] = await db.select({ id: customerFavorites.id })
      .from(customerFavorites)
      .where(and(eq(customerFavorites.customerId, user.customerId), eq(customerFavorites.dishId, body.dishId)));
    if (existing) return { favorite: existing, message: 'Already in favorites' };
    const [fav] = await db.insert(customerFavorites)
      .values({ customerId: user.customerId, dishId: body.dishId })
      .returning();
    await redis.del(`cache:customer:favorites:${user.customerId}`);
    return { favorite: fav };
  });

  // Remove favorite
  app.delete('/api/v1/customer/favorites/:dishId', async (request, reply) => {
    const user = request.user;
    const dishId = parseInt((request.params as any).dishId);
    if (isNaN(dishId)) return reply.status(400).send({ error: 'Invalid dish ID' });
    const [existing] = await db.select({ id: customerFavorites.id })
      .from(customerFavorites)
      .where(and(eq(customerFavorites.customerId, user.customerId), eq(customerFavorites.dishId, dishId)));
    if (!existing) return reply.status(404).send({ error: 'Favorite not found' });
    await db.delete(customerFavorites).where(eq(customerFavorites.id, existing.id));
    await redis.del(`cache:customer:favorites:${user.customerId}`);
    return { success: true };
  });

  // Check if dish is favorited
  app.get('/api/v1/customer/favorites/check/:dishId', async (request) => {
    const user = request.user;
    const dishId = parseInt((request.params as any).dishId);
    if (isNaN(dishId)) return { isFavorited: false };
    const [existing] = await db.select({ id: customerFavorites.id })
      .from(customerFavorites)
      .where(and(eq(customerFavorites.customerId, user.customerId), eq(customerFavorites.dishId, dishId)));
    return { isFavorited: !!existing };
  });

  // ── Customer Stats ──
  app.get('/api/v1/customer/stats', async (request) => {
    const user = request.user;
    const cacheKey = `cache:customer:stats:${user.customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [totalOrders] = await db.select({ value: count() })
      .from(orders).where(eq(orders.customerId, user.customerId));

    const [totalSpent] = await db.select({
      value: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders).where(and(
      eq(orders.customerId, user.customerId),
      eq(orders.status, 'DELIVERED'),
    ));

    const [avgOrderValue] = await db.select({
      value: sql<number>`COALESCE(AVG(${orders.totalAmount}), 0)`,
    }).from(orders).where(and(
      eq(orders.customerId, user.customerId),
      eq(orders.status, 'DELIVERED'),
    ));

    const [favoriteCount] = await db.select({ value: count() })
      .from(customerFavorites).where(eq(customerFavorites.customerId, user.customerId));

    const [addressCount] = await db.select({ value: count() })
      .from(customerAddresses).where(eq(customerAddresses.customerId, user.customerId));

    const [lastOrder] = await db.select({
      date: orders.createdAt,
      total: orders.totalAmount,
      status: orders.status,
    }).from(orders)
      .where(eq(orders.customerId, user.customerId))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    const recentOrders = await db.select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
    }).from(orders)
      .where(eq(orders.customerId, user.customerId))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    const result = {
      totalOrders: totalOrders?.value || 0,
      totalSpent: totalSpent?.value || 0,
      avgOrderValue: Math.round((avgOrderValue?.value || 0) * 100) / 100,
      favoriteCount: favoriteCount?.value || 0,
      addressCount: addressCount?.value || 0,
      lastOrder: lastOrder || null,
      recentOrders,
    };
    await redis.setex(cacheKey, CUSTOMER_STATS_CACHE_TTL, JSON.stringify(result));
    return result;
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
