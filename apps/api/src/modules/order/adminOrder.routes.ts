import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { orders, orderItems } from '../../db/schemas/order.js';
import { dishes } from '../../db/schemas/menu.js';
import { eq, desc, sql, count, inArray, gte } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';

export async function adminOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  const VALID_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED']);

  app.get('/api/v1/admin/orders', async (request) => {
    const { status, limit, offset } = request.query as { status?: string; limit?: string; offset?: string };
    const queryLimit = parseInt(limit || '50');
    const queryOffset = parseInt(offset || '0');

    let query = db.select().from(orders).$dynamic();
    let countQuery = db.select({ count: count() }).from(orders).$dynamic();

    if (status) {
      if (!VALID_STATUSES.has(status)) {
        return { error: 'Invalid status', validStatuses: [...VALID_STATUSES] };
      }
      query = query.where(eq(orders.status, status as any)) as any;
      countQuery = countQuery.where(eq(orders.status, status as any)) as any;
    }

    const [{ count: total }] = await countQuery;
    const data = await query
      .orderBy(desc(orders.createdAt))
      .limit(queryLimit)
      .offset(queryOffset);

    // Fetch items for all returned orders
    const orderIds = data.map(o => o.id);
    let itemsWithNames: any[] = [];
    if (orderIds.length > 0) {
      itemsWithNames = await db
        .select({
          orderId: orderItems.orderId,
          id: orderItems.id,
          dishId: orderItems.dishId,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          modifiers: orderItems.modifiers,
          dishName: dishes.name,
          isVeg: dishes.isVeg,
        })
        .from(orderItems)
        .leftJoin(dishes, eq(orderItems.dishId, dishes.id))
        .where(inArray(orderItems.orderId, orderIds));
    }

    // Group items by orderId and attach to each order
    const itemsByOrder = new Map<number, any[]>();
    for (const item of itemsWithNames) {
      const list = itemsByOrder.get(item.orderId) || [];
      list.push({
        id: item.id,
        dishId: item.dishId,
        dishName: item.dishName || `Dish #${item.dishId}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        modifiers: item.modifiers,
        isVeg: item.isVeg,
      });
      itemsByOrder.set(item.orderId, list);
    }

    const dataWithItems = data.map(o => ({
      ...o,
      items: itemsByOrder.get(o.id) || [],
    }));

    return { data: dataWithItems, total: Number(total), hasMore: queryOffset + queryLimit < Number(total) };
  });

  app.get('/api/v1/admin/orders/stats', async (request) => {
    const { period = 'today' } = request.query as { period?: string };

    let dateFilter;
    if (period === 'week') {
      dateFilter = sql`${orders.createdAt} >= NOW() - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilter = sql`${orders.createdAt} >= NOW() - INTERVAL '30 days'`;
    } else {
      dateFilter = sql`${orders.createdAt} >= CURRENT_DATE`;
    }

    const statusCounts = await db.select({
      status: orders.status,
      count: count(),
    }).from(orders)
      .where(dateFilter)
      .groupBy(orders.status);

    const countMap: Record<string, number> = {};
    for (const r of statusCounts) {
      countMap[r.status] = r.count;
    }

    const revenue = await db.select({
      total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: count(),
    }).from(orders).where(dateFilter);

    const row = revenue[0] || { count: 0, total: '0' };

    return {
      period,
      totalToday: parseInt(row.count.toString()),
      revenueToday: Math.round(parseFloat(row.total) * 100) / 100,
      pending: countMap['PENDING'] || 0,
      confirmed: countMap['CONFIRMED'] || 0,
      preparing: countMap['PREPARING'] || 0,
      ready: countMap['READY'] || 0,
      outForDelivery: countMap['OUT_FOR_DELIVERY'] || 0,
      delivered: countMap['DELIVERED'] || 0,
      cancelled: countMap['CANCELLED'] || 0,
    };
  });

  app.get('/api/v1/admin/analytics/revenue', async () => {
    const sevenDaysAgo = sql`NOW() - INTERVAL '7 days'`;
    const thirtyDaysAgo = sql`NOW() - INTERVAL '30 days'`;

    const revenue7d = await db.select({
      total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: count(),
    }).from(orders).where(gte(orders.createdAt, sevenDaysAgo));

    const revenue30d = await db.select({
      total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: count(),
    }).from(orders).where(gte(orders.createdAt, thirtyDaysAgo));

    const ordersByDay = await db.select({
      day: sql<string>`DATE(created_at)`.as('day'),
      count: count(),
    }).from(orders).where(gte(orders.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    const ordersByDayMap: Record<string, number> = {};
    for (const r of ordersByDay) {
      ordersByDayMap[r.day] = r.count;
    }

    const r7d = revenue7d[0] || { total: '0', count: 0 };
    const r30d = revenue30d[0] || { total: '0', count: 0 };
    const rev7d = parseFloat(r7d.total);
    const count7d = parseInt(r7d.count.toString());

    return {
      revenue7d: rev7d,
      revenue30d: parseFloat(r30d.total),
      orders7d: count7d,
      orders30d: parseInt(r30d.count.toString()),
      avgOrderValue7d: count7d > 0 ? rev7d / count7d : 0,
      ordersByDay7d: ordersByDayMap,
    };
  });

  app.get('/api/v1/admin/analytics/top-dishes', async () => {
    const items = await db.select({
      dishId: orderItems.dishId,
      totalQty: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<number>`SUM(${orderItems.unitPrice}::numeric * ${orderItems.quantity})`,
    }).from(orderItems)
      .groupBy(orderItems.dishId)
      .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
      .limit(10);

    return items.map(item => ({
      dishId: item.dishId,
      count: item.totalQty,
      revenue: item.totalRevenue,
    }));
  });

  app.get('/api/v1/admin/analytics/peak-hours', async () => {
    const hourCounts = await db.select({
      hour: sql<number>`EXTRACT(HOUR FROM created_at)`.as('hour'),
      count: count(),
    }).from(orders)
      .groupBy(sql`EXTRACT(HOUR FROM created_at)`)
      .orderBy(sql`EXTRACT(HOUR FROM created_at)`);

    return hourCounts.map(r => ({
      hour: r.hour,
      count: r.count,
    }));
  });

  app.get('/api/v1/admin/analytics/automation-efficiency', async () => {
    const { automationLogs: logsSchema } = await import('../../db/schemas/automation.js');
    const logs = await db.select().from(logsSchema);
    const totalAutomated = logs.length;
    const allOrders = await db.select().from(orders);
    const now = new Date();
    const todayOrders = allOrders.filter(o => new Date(o.createdAt!).toDateString() === now.toDateString());

    const manualInterventions = todayOrders.filter(o => {
      const h = logs.filter(l => l.payload && typeof l.payload === 'object' && (l.payload as any).orderId === o.id);
      return h.length === 0;
    }).length;

    return {
      totalAutomatedActions24h: totalAutomated,
      ordersToday: todayOrders.length,
      estimatedManualInterventions: manualInterventions,
      automationRate: todayOrders.length > 0
        ? Math.round(((todayOrders.length - manualInterventions) / todayOrders.length) * 100)
        : 100,
    };
  });
}
