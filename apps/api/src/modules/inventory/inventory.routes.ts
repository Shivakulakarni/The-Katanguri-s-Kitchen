import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { ingredients, inventoryTransactions } from '../../db/schemas/inventory.js';
import { eq, asc, and, desc, sql, inArray } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { publishEvent } from '../../utils/eventBus.js';

export async function inventoryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  app.get('/api/v1/admin/inventory', async () => {
    return db.select().from(ingredients).orderBy(asc(ingredients.name));
  });

  app.get('/api/v1/admin/inventory/low-stock', async () => {
    return db.select().from(ingredients).where(sql`CAST(${ingredients.currentStock} AS DECIMAL) < CAST(${ingredients.parLevel} AS DECIMAL)`).orderBy(asc(ingredients.name));
  });

  app.post('/api/v1/admin/inventory', async (request) => {
    const body = request.body as any;
    const [item] = await db.insert(ingredients).values({
      name: body.name,
      unit: body.unit,
      currentStock: String(body.currentStock || 0),
      parLevel: String(body.parLevel || 10),
      unitCost: String(body.unitCost || 0),
    }).returning();
    return item;
  });

  async function handleStockUpdate(request: any, reply: any) {
    const { id } = request.params as { id: string };
    const { quantity, reason, delta } = request.body as { quantity?: string; reason?: string; delta?: string };
    const changeQty = quantity || delta;

    const qtyNum = parseFloat(changeQty!);
    if (isNaN(qtyNum) || qtyNum === 0) {
      return reply.status(400).send({ error: 'Invalid quantity' });
    }

    const ingredientId = parseInt(id);

    const [updated] = await db.update(ingredients)
      .set({ currentStock: sql`${ingredients.currentStock} + ${changeQty}`, updatedAt: new Date() })
      .where(and(
        eq(ingredients.id, ingredientId),
        sql`${ingredients.currentStock} + ${changeQty} >= 0`
      ))
      .returning();

    if (!updated) {
      return reply.status(400).send({ error: 'Insufficient stock' });
    }

    await db.insert(inventoryTransactions).values({
      ingredientId,
      changeQty: changeQty!,
      reason: reason || 'manual_adjustment',
    });

    await publishEvent('inventory.updated', { ingredientId: updated.id, currentStock: updated.currentStock });

    return updated;
  }

  app.post('/api/v1/admin/inventory/:id/stock', handleStockUpdate);
  app.patch('/api/v1/admin/inventory/:id/stock', handleStockUpdate);

  app.get('/api/v1/admin/inventory/transactions', async () => {
    return db.select().from(inventoryTransactions).orderBy(desc(inventoryTransactions.createdAt)).limit(100);
  });

  app.get('/api/v1/admin/inventory/forecast', async () => {
    const all = await db.select({
      id: ingredients.id, name: ingredients.name, currentStock: ingredients.currentStock,
    }).from(ingredients);
    const forecast: Array<Record<string, unknown>> = [];

    const ingredientIds = all.map(ing => ing.id);
    if (ingredientIds.length === 0) return forecast;

    const txSummary = await db.select({
      ingredientId: inventoryTransactions.ingredientId,
      totalQty: sql<string>`SUM(ABS(CAST(${inventoryTransactions.changeQty} AS DECIMAL)))`,
      txCount: sql<number>`COUNT(*)`,
    }).from(inventoryTransactions)
      .where(and(
        inArray(inventoryTransactions.ingredientId, ingredientIds),
        eq(inventoryTransactions.reason, 'order_deduction')
      ))
      .groupBy(inventoryTransactions.ingredientId);

    const txMap = new Map(txSummary.map(t => [t.ingredientId, { total: parseFloat(t.totalQty), count: t.txCount }]));

    for (const ing of all) {
      const data = txMap.get(ing.id);
      if (!data || data.count < 3) {
        forecast.push({ ingredientId: ing.id, name: ing.name, status: 'insufficient_data' });
        continue;
      }

      const dailyAvg = data.total / data.count;
      const daysUntilEmpty = dailyAvg > 0 ? parseFloat(ing.currentStock.toString()) / dailyAvg : Infinity;

      forecast.push({
        ingredientId: ing.id,
        name: ing.name,
        dailyAvgConsumption: Math.round(dailyAvg * 100) / 100,
        currentStock: parseFloat(ing.currentStock.toString()),
        daysUntilEmpty: Math.round(daysUntilEmpty * 10) / 10,
        status: daysUntilEmpty <= 2 ? 'CRITICAL' : daysUntilEmpty <= 7 ? 'LOW' : 'OK',
      });
    }
    return forecast;
  });
}
