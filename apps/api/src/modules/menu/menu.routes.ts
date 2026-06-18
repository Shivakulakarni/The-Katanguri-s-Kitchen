import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { categories, dishes, dishModifiers } from '../../db/schemas/menu.js';
import { eq, asc } from 'drizzle-orm';
import { redis } from '../../utils/redis.js';
import { publishEvent } from '../../utils/eventBus.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { createCategorySchema, createDishSchema, createModifierSchema, updateModifierSchema } from '../../lib/validation.js';
import { MENU_CACHE_KEY, MENU_CACHE_TTL } from '../../lib/constants.js';
import { auditLog, diffChanges, type AuditContext } from '../../utils/audit.js';

function getAuditCtx(request: any): AuditContext {
  const user = request.user;
  return user ? { userId: user.customerId, userRole: user.role } : {};
}

export async function menuRoutes(app: FastifyInstance) {
  app.get('/api/v1/menu', async (request) => {
    const { category } = request.query as { category?: string };

    const cached = await redis.get(MENU_CACHE_KEY);
    if (cached && !category) {
      return JSON.parse(cached);
    }

    if (category) {
      const categoryKey = `${MENU_CACHE_KEY}:cat:${category.toLowerCase()}`;
      const cachedCategory = await redis.get(categoryKey);
      if (cachedCategory) return JSON.parse(cachedCategory);
    }

    const cats = await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.displayOrder));
    const allDishes = await db.select().from(dishes);
    const dishMap = new Map<number, typeof allDishes>();
    for (const d of allDishes) {
      const arr = dishMap.get(d.categoryId) || [];
      arr.push(d);
      dishMap.set(d.categoryId, arr);
    }
    const menu = cats.map(cat => ({
      ...cat,
      dishes: dishMap.get(cat.id) || [],
    }));

    if (!category) {
      await redis.setex(MENU_CACHE_KEY, MENU_CACHE_TTL, JSON.stringify(menu));
    }

    if (category) {
      const filtered = menu.filter(c => c.name.toLowerCase() === category.toLowerCase());
      const categoryKey = `${MENU_CACHE_KEY}:cat:${category.toLowerCase()}`;
      await redis.setex(categoryKey, MENU_CACHE_TTL, JSON.stringify(filtered));
      return filtered;
    }
    return menu;
  });

  app.get('/api/v1/menu/categories', async () => {
    return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.displayOrder));
  });

  // ⚠️  IMPORTANT: Static sub-paths MUST come before the /:dishId param route
  app.get('/api/v1/menu/dishes', async (request) => {
    const { categoryId, veg } = request.query as { categoryId?: string; veg?: string };
    let query = db.select().from(dishes).$dynamic();
    if (categoryId && !isNaN(parseInt(categoryId))) {
      query = query.where(eq(dishes.categoryId, parseInt(categoryId))) as any;
    }
    const all = await query;
    if (veg === 'true') return all.filter(d => d.isVeg === true);
    if (veg === 'false') return all.filter(d => d.isVeg === false);
    return all;
  });

  app.get('/api/v1/menu/dishes/modifiers', async () => {
    const allMods = await db.select().from(dishModifiers);
    const grouped: Record<number, any[]> = {};
    for (const mod of allMods) {
      if (!grouped[mod.dishId]) grouped[mod.dishId] = [];
      grouped[mod.dishId].push({ name: mod.name, type: mod.type, options: mod.options, isRequired: mod.isRequired });
    }
    return grouped;
  });

  // /:dishId MUST come after static sub-paths
  app.get('/api/v1/menu/:dishId', async (request, reply) => {
    const { dishId } = request.params as { dishId: string };
    const id = parseInt(dishId);
    if (isNaN(id)) return reply.status(400).send({ error: 'Invalid dish ID' });
    const [dish] = await db.select().from(dishes).where(eq(dishes.id, id)).limit(1);
    if (!dish) return reply.status(404).send({ error: 'Dish not found' });
    const mods = await db.select().from(dishModifiers).where(eq(dishModifiers.dishId, dish.id));
    return { ...dish, modifiers: mods };
  });

  app.post('/api/v1/admin/menu/dishes/:id/modifiers', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = await validateBody(request, reply, createModifierSchema);
    if (body === null) return;
    const [mod] = await db.insert(dishModifiers).values({
      dishId: parseInt(id), name: body.name, type: body.type || 'single',
      options: body.options || [], isRequired: body.isRequired ?? false,
    }).returning();
    return mod;
  });

  app.patch('/api/v1/admin/menu/dishes/:dishId/modifiers/:modId', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = await validateBody(request, reply, updateModifierSchema);
    if (body === null) return;
    const { modId } = request.params as { dishId: string; modId: string };
    const allowedFields: Record<string, any> = {};
    if (body.name !== undefined) allowedFields.name = body.name;
    if (body.type !== undefined) allowedFields.type = body.type;
    if (body.options !== undefined) allowedFields.options = body.options;
    if (body.isRequired !== undefined) allowedFields.isRequired = body.isRequired;
    if (Object.keys(allowedFields).length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update' });
    }
    const [updated] = await db.update(dishModifiers)
      .set(allowedFields)
      .where(eq(dishModifiers.id, parseInt(modId)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Modifier not found' });
    return updated;
  });

  app.delete('/api/v1/admin/menu/dishes/:dishId/modifiers/:modId', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { modId } = request.params as { dishId: string; modId: string };
    const deleted = await db.delete(dishModifiers).where(eq(dishModifiers.id, parseInt(modId))).returning();
    if (!deleted.length) return reply.status(404).send({ error: 'Modifier not found' });
    return { success: true };
  });

  app.delete('/api/v1/admin/menu/dishes/modifiers/:modId', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { modId } = request.params as { modId: string };
    const deleted = await db.delete(dishModifiers).where(eq(dishModifiers.id, parseInt(modId))).returning();
    if (!deleted.length) return reply.status(404).send({ error: 'Modifier not found' });
    return { success: true };
  });

  app.post('/api/v1/admin/menu/categories', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = await validateBody(request, reply, createCategorySchema);
    if (body === null) return;
    const [cat] = await db.insert(categories).values({
      name: body.name,
      description: body.description,
      displayOrder: body.displayOrder || 0,
      imageUrl: body.imageUrl,
    }).returning();
    await redis.del(MENU_CACHE_KEY);
    await auditLog({ entityType: 'category', entityId: cat.id, action: 'create', changes: { name: body.name, description: body.description }, ctx: getAuditCtx(request) });
    return cat;
  });

  app.post('/api/v1/admin/menu/dishes', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = await validateBody(request, reply, createDishSchema);
    if (body === null) return;
    const [dish] = await db.insert(dishes).values({
      categoryId: body.categoryId,
      name: body.name,
      description: body.description,
      price: String(body.price),
      prepTimeMin: body.prepTimeMin || 15,
      dietaryTags: JSON.stringify(body.dietaryTags || []),
      imageUrl: body.imageUrl,
      isVeg: body.isVeg ?? true,
    }).returning();
    await redis.del(MENU_CACHE_KEY);
    await auditLog({ entityType: 'dish', entityId: dish.id, action: 'create', changes: { name: body.name, price: body.price, categoryId: body.categoryId }, ctx: getAuditCtx(request) });
    return dish;
  });

  app.delete('/api/v1/admin/menu/dishes/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.update(dishes).set({ isAvailable: false, updatedAt: new Date() }).where(eq(dishes.id, parseInt(id))).returning();
    if (!deleted.length) return reply.status(404).send({ error: 'Dish not found' });
    await redis.del(MENU_CACHE_KEY);
    await publishEvent('menu.updated', { dishId: parseInt(id), isAvailable: false });
    await auditLog({ entityType: 'dish', entityId: parseInt(id), action: 'delete', changes: { isAvailable: { before: true, after: false } }, ctx: getAuditCtx(request) });
    return { success: true };
  });

  app.delete('/api/v1/admin/menu/categories/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.update(categories).set({ isActive: false }).where(eq(categories.id, parseInt(id))).returning();
    if (!deleted.length) return reply.status(404).send({ error: 'Category not found' });
    await redis.del(MENU_CACHE_KEY);
    await auditLog({ entityType: 'category', entityId: parseInt(id), action: 'delete', changes: { isActive: { before: true, after: false } }, ctx: getAuditCtx(request) });
    return { success: true };
  });

  app.patch('/api/v1/admin/menu/categories/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const allowedFields: Record<string, any> = {};
    if (body.name !== undefined) allowedFields.name = body.name;
    if (body.description !== undefined) allowedFields.description = body.description;
    if (body.displayOrder !== undefined) allowedFields.displayOrder = body.displayOrder;
    if (body.imageUrl !== undefined) allowedFields.imageUrl = body.imageUrl;
    if (body.isActive !== undefined) allowedFields.isActive = body.isActive;
    allowedFields.updatedAt = new Date();

    if (Object.keys(allowedFields).length <= 1) {
      return reply.status(400).send({ error: 'No valid fields to update' });
    }

    const [updated] = await db.update(categories).set(allowedFields).where(eq(categories.id, parseInt(id))).returning();
    if (!updated) return reply.status(404).send({ error: 'Category not found' });
    await redis.del(MENU_CACHE_KEY);
    return updated;
  });

  app.patch('/api/v1/admin/menu/dishes/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    // SECURITY: Whitelist allowed fields to prevent mass assignment
    const allowedFields: Record<string, any> = {};
    if (body.name !== undefined) allowedFields.name = body.name;
    if (body.description !== undefined) allowedFields.description = body.description;
    if (body.price !== undefined) allowedFields.price = String(body.price);
    if (body.categoryId !== undefined) allowedFields.categoryId = body.categoryId;
    if (body.imageUrl !== undefined) allowedFields.imageUrl = body.imageUrl;
    if (body.isVeg !== undefined) allowedFields.isVeg = body.isVeg;
    if (body.isAvailable !== undefined) allowedFields.isAvailable = body.isAvailable;
    if (body.prepTimeMin !== undefined) allowedFields.prepTimeMin = body.prepTimeMin;
    if (body.dietaryTags !== undefined) allowedFields.dietaryTags = JSON.stringify(body.dietaryTags);
    allowedFields.updatedAt = new Date();

    if (Object.keys(allowedFields).length <= 1) {
      return reply.status(400).send({ error: 'No valid fields to update' });
    }

    const [updated] = await db.update(dishes).set(allowedFields).where(eq(dishes.id, parseInt(id))).returning();
    if (!updated) return reply.status(404).send({ error: 'Dish not found' });
    await redis.del(MENU_CACHE_KEY);
    if (body.isAvailable !== undefined) {
      await publishEvent('menu.updated', { dishId: updated.id, isAvailable: updated.isAvailable });
    }
    await auditLog({ entityType: 'dish', entityId: parseInt(id), action: 'update', changes: diffChanges({}, allowedFields, Object.keys(allowedFields).filter(k => k !== 'updatedAt')), ctx: getAuditCtx(request) });
    return updated;
  });
}
