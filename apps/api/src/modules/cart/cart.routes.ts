import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { cartItems } from '../../db/schemas/cart.js';
import { dishes } from '../../db/schemas/menu.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'cart' });

export async function cartRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // ── GET /api/v1/cart — Get current customer's cart ──
  app.get('/api/v1/cart', async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'customer') return reply.status(403).send({ error: 'Customer access required' });

    const items = await db.select({
      id: cartItems.id,
      dishId: cartItems.dishId,
      quantity: cartItems.quantity,
      modifiers: cartItems.modifiers,
      createdAt: cartItems.createdAt,
      dishName: dishes.name,
      dishPrice: dishes.price,
      dishImageUrl: dishes.imageUrl,
      isVeg: dishes.isVeg,
    }).from(cartItems)
      .leftJoin(dishes, eq(cartItems.dishId, dishes.id))
      .where(eq(cartItems.customerId, user.customerId))
      .orderBy(cartItems.createdAt);

    const total = items.reduce((sum, item) => {
      const price = item.dishPrice ? parseFloat(item.dishPrice.toString()) : 0;
      return sum + price * item.quantity;
    }, 0);

    return {
      items: items.map(i => ({
        id: i.id,
        dishId: i.dishId,
        dishName: i.dishName || `Dish #${i.dishId}`,
        dishPrice: i.dishPrice,
        dishImageUrl: i.dishImageUrl,
        isVeg: i.isVeg,
        quantity: i.quantity,
        modifiers: i.modifiers,
        lineTotal: i.dishPrice ? parseFloat(i.dishPrice.toString()) * i.quantity : 0,
      })),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      total: Math.round(total * 100) / 100,
    };
  });

  // ── POST /api/v1/cart/items — Add item to cart ──
  app.post('/api/v1/cart/items', async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'customer') return reply.status(403).send({ error: 'Customer access required' });

    const { dishId, quantity = 1, modifiers } = request.body as { dishId?: number; quantity?: number; modifiers?: string };
    if (!dishId || typeof dishId !== 'number') {
      return reply.status(400).send({ error: 'dishId is required and must be a number' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return reply.status(400).send({ error: 'quantity must be between 1 and 99' });
    }

    // Verify dish exists
    const [dish] = await db.select().from(dishes).where(eq(dishes.id, dishId)).limit(1);
    if (!dish) return reply.status(404).send({ error: 'Dish not found' });
    if (dish.isAvailable === false) return reply.status(400).send({ error: 'Dish is no longer available' });

    // Check if item already in cart
    const [existing] = await db.select().from(cartItems)
      .where(and(eq(cartItems.customerId, user.customerId), eq(cartItems.dishId, dishId)))
      .limit(1);

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > 99) {
        return reply.status(400).send({ error: `Cannot add more. Cart already has ${existing.quantity} of this item (max 99)` });
      }
      const [updated] = await db.update(cartItems)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(eq(cartItems.id, existing.id))
        .returning();

      log.info({ customerId: user.customerId, dishId, quantity: newQty }, '[Cart] Updated item');
      return { item: { id: updated.id, dishId, quantity: updated.quantity, modifiers } };
    }

    const [item] = await db.insert(cartItems).values({
      customerId: user.customerId,
      dishId,
      quantity,
      modifiers: modifiers || null,
    }).returning();

    log.info({ customerId: user.customerId, dishId, quantity }, '[Cart] Added item');
    return { item: { id: item.id, dishId, quantity: item.quantity, modifiers } };
  });

  // ── PUT /api/v1/cart/items/:id — Update item quantity ──
  app.put('/api/v1/cart/items/:id', async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'customer') return reply.status(403).send({ error: 'Customer access required' });

    const { id } = request.params as { id: string };
    const body = request.body as { quantity?: number };
    const quantity = body.quantity;
    if (quantity == null || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return reply.status(400).send({ error: 'quantity must be between 1 and 99' });
    }

    const [existing] = await db.select().from(cartItems)
      .where(and(eq(cartItems.id, parseInt(id)), eq(cartItems.customerId, user.customerId)))
      .limit(1);
    if (!existing) return reply.status(404).send({ error: 'Cart item not found' });

    const [updated] = await db.update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existing.id))
      .returning();

    return { item: { id: updated.id, dishId: updated.dishId, quantity: updated.quantity } };
  });

  // ── DELETE /api/v1/cart/items/:id — Remove item from cart ──
  app.delete('/api/v1/cart/items/:id', async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'customer') return reply.status(403).send({ error: 'Customer access required' });

    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(cartItems)
      .where(and(eq(cartItems.id, parseInt(id)), eq(cartItems.customerId, user.customerId)))
      .limit(1);
    if (!existing) return reply.status(404).send({ error: 'Cart item not found' });

    await db.delete(cartItems).where(eq(cartItems.id, existing.id));
    return { success: true };
  });

  // ── DELETE /api/v1/cart — Clear entire cart ──
  app.delete('/api/v1/cart', async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'customer') return reply.status(403).send({ error: 'Customer access required' });

    await db.delete(cartItems).where(eq(cartItems.customerId, user.customerId));
    return { success: true, message: 'Cart cleared' };
  });
}
