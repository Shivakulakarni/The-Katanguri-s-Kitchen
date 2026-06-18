import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db/connection.js';
import { auditLogs } from '../../db/schemas/audit.js';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  // List audit logs with pagination and filtering
  app.get('/api/v1/admin/audit-logs', async (request) => {
    const { limit = '50', offset = '0', entityType, action, userId, from, to } =
      request.query as {
        limit?: string; offset?: string; entityType?: string;
        action?: string; userId?: string; from?: string; to?: string;
      };

    const conditions = [];
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (userId) conditions.push(eq(auditLogs.userId, parseInt(userId)));
    if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to) conditions.push(lte(auditLogs.createdAt, new Date(to + 'T23:59:59')));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db.select().from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const totalResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where);

    return { logs, total: totalResult[0]?.count ?? 0 };
  });

  // Get audit trail for a specific entity
  app.get('/api/v1/admin/audit-logs/entity/:type/:id', async (request) => {
    const { type, id } = request.params as { type: string; id: string };
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    const logs = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.entityType, type), eq(auditLogs.entityId, parseInt(id))))
      .orderBy(desc(auditLogs.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    return { logs };
  });

  // Get audit summary (action counts by entity type)
  app.get('/api/v1/admin/audit-logs/summary', async () => {
    const summary = await db.select({
      entityType: auditLogs.entityType,
      action: auditLogs.action,
      count: sql<number>`count(*)::int`,
    }).from(auditLogs)
      .groupBy(auditLogs.entityType, auditLogs.action);

    return { summary };
  });
}
