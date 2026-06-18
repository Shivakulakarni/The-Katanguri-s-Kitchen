import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { automationRules } from '../../db/schemas/automation.js';
import { eq, desc } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';

export async function automationRuleRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireAdmin);

  app.get('/api/v1/admin/automation/rules', async () => {
    return db.select().from(automationRules);
  });

  app.post('/api/v1/admin/automation/rules', async (request) => {
    const body = request.body as any;
    const [rule] = await db.insert(automationRules).values({
      name: body.name,
      trigger: body.trigger,
      conditions: body.conditions || [],
      actions: body.actions || [],
      isActive: body.isActive ?? true,
    }).returning();
    return rule;
  });

  app.put('/api/v1/admin/automation/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, parseInt(id))).limit(1);
    if (!rule) return reply.status(404).send({ error: 'Rule not found' });
    const [updated] = await db.update(automationRules)
      .set({
        name: body.name,
        trigger: body.trigger,
        conditions: body.conditions,
        actions: body.actions,
        isActive: body.isActive,
        version: (rule.version || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(automationRules.id, parseInt(id)))
      .returning();
    return updated;
  });

  app.delete('/api/v1/admin/automation/rules/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.delete(automationRules).where(eq(automationRules.id, parseInt(id)));
    return { success: true };
  });

  app.post('/api/v1/admin/automation/rules/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, parseInt(id))).limit(1);
    if (!rule) return reply.status(404).send({ error: 'Rule not found' });
    const [updated] = await db.update(automationRules)
      .set({ isActive: !rule.isActive, updatedAt: new Date() })
      .where(eq(automationRules.id, parseInt(id)))
      .returning();
    return updated;
  });

  app.post('/api/v1/admin/automation/rules/dry-run', async (request) => {
    const { rule } = request.body as any;
    // Evaluate rule against mock event without side effects
    const conditions = rule.conditions || [];
    const results = conditions.map((c: any) => ({
      condition: c,
      result: 'simulated_match',
    }));
    const actions = (rule.actions || []).map((a: any) => ({
      action: a,
      wouldExecute: true,
      sideEffect: 'none (dry-run)',
    }));
    return { conditions: results, actions };
  });

  app.get('/api/v1/admin/automation/logs', async (request) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const { automationLogs: logsSchema } = await import('../../db/schemas/automation.js');
    const queryLimit = Math.min(Math.max(parseInt(limit || '50') || 50, 1), 200);
    const queryOffset = Math.max(parseInt(offset || '0') || 0, 0);
    return db.select().from(logsSchema)
      .orderBy(desc(logsSchema.createdAt))
      .limit(queryLimit)
      .offset(queryOffset);
  });

  app.get('/api/v1/admin/automation/stats', async () => {
    const { automationLogs: logsSchema } = await import('../../db/schemas/automation.js');
    const logs = await db.select().from(logsSchema);
    const total = logs.length;
    const success = logs.filter(l => l.status === 'success').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    return {
      totalExecutions: total,
      successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      failedCount: failed,
      byWorkflow: logs.reduce((acc: Record<string, number>, l) => {
        acc[l.workflowName] = (acc[l.workflowName] || 0) + 1;
        return acc;
      }, {}),
    };
  });
}
