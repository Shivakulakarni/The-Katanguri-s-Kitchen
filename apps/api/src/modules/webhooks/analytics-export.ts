import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { incomingOrders } from '../../db/schemas/delivery.js';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';

/**
 * Analytics export routes — generates CSV and text-based reports for webhook performance.
 * Production would use a proper PDF library like PDFKit or jsPDF.
 */
export async function analyticsExportRoutes(app: FastifyInstance) {
  // Admin: export webhook analytics as CSV
  app.get('/api/v1/admin/webhooks/export/csv', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { days = '30', source } = request.query as { days?: string; source?: string };

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const whereClause = source
      ? and(gte(incomingOrders.createdAt, since), eq(incomingOrders.source, source))
      : gte(incomingOrders.createdAt, since);

    const allOrders = await db.select().from(incomingOrders)
      .where(whereClause)
      .orderBy(incomingOrders.createdAt);

    // Build CSV with proper quoting for all text fields
    const csvEscape = (val: string) => val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
    const headers = ['ID', 'External ID', 'Source', 'Status', 'Customer Name', 'Customer Phone', 'Internal Order ID', 'Error Message', 'Created At', 'Processed At'];
    const rows = allOrders.map(o => [
      o.id,
      o.externalId,
      o.source,
      o.status,
      csvEscape(o.customerName || ''),
      csvEscape(o.customerPhone || ''), // quoted for safety
      o.internalOrderId || '',
      csvEscape(o.errorMessage || ''),
      o.createdAt ? new Date(o.createdAt).toISOString() : '',
      o.processedAt ? new Date(o.processedAt).toISOString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="webhook-analytics-${days}d${source ? `-${source}` : ''}.csv"`);
    return reply.send(csv);
  });

  // Admin: export analytics summary report (text-based, production would use PDF)
  app.get('/api/v1/admin/webhooks/export/report', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { days = '7' } = request.query as { days?: string };
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const sources = ['swiggy', 'zomato', 'urbanpiper', 'posist', 'generic'];

    const reportData = await Promise.all(sources.map(async (source) => {
      const stats = await db.select({
        total: count(),
        failed: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'failed' THEN 1 ELSE 0 END)`.as('failed'),
        created: sql<number>`SUM(CASE WHEN ${incomingOrders.status} = 'created' THEN 1 ELSE 0 END)`.as('created'),
        avgTime: sql<number>`AVG(CASE WHEN ${incomingOrders.processedAt} IS NOT NULL THEN EXTRACT(EPOCH FROM (${incomingOrders.processedAt} - ${incomingOrders.createdAt})) END)`.as('avg_time'),
      }).from(incomingOrders)
        .where(and(gte(incomingOrders.createdAt, since), eq(incomingOrders.source, source)));

      const s = stats[0];
      const total = s.total || 0;
      const failed = Number(s.failed) || 0;
      const created = Number(s.created) || 0;
      const errorRate = total > 0 ? (failed / total * 100) : 0;

      return { source, total, failed, created, errorRate, avgTime: s.avgTime || 0 };
    }));

    // Calculate totals
    const totals = reportData.reduce((acc, r) => ({
      total: acc.total + r.total,
      failed: acc.failed + r.failed,
      created: acc.created + r.created,
    }), { total: 0, failed: 0, created: 0 });

    // Build text report
    const lines = [
      '═══════════════════════════════════════════════════',
      '  THE KATANGURI\'S KITCHEN — Webhook Analytics Report',
      '═══════════════════════════════════════════════════',
      '',
      `  Period: Last ${days} days`,
      `  Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      '',
      '───────────────────────────────────────────────────',
      '  SUMMARY',
      '───────────────────────────────────────────────────',
      `  Total Orders:  ${totals.total}`,
      `  Created:       ${totals.created}`,
      `  Failed:        ${totals.failed}`,
      `  Error Rate:    ${totals.total > 0 ? ((totals.failed / totals.total) * 100).toFixed(1) : 0}%`,
      '',
      '───────────────────────────────────────────────────',
      '  BY PLATFORM',
      '───────────────────────────────────────────────────',
    ];

    for (const r of reportData) {
      if (r.total === 0) continue;
      const statusIcon = r.errorRate > 20 ? '🔴' : r.errorRate > 5 ? '🟡' : '🟢';
      lines.push(
        `  ${statusIcon} ${r.source.toUpperCase()}`,
        `    Orders: ${r.total} | Created: ${r.created} | Failed: ${r.failed}`,
        `    Error Rate: ${r.errorRate.toFixed(1)}% | Avg Processing: ${r.avgTime.toFixed(1)}s`,
        '',
      );
    }

    lines.push(
      '───────────────────────────────────────────────────',
      '  END OF REPORT',
      '───────────────────────────────────────────────────',
    );

    // Also generate a JSON version
    const jsonReport = {
      title: 'Webhook Analytics Report',
      restaurant: 'The Katanguri\'s Kitchen',
      period: `Last ${days} days`,
      generatedAt: new Date().toISOString(),
      summary: { ...totals, errorRate: totals.total > 0 ? (totals.failed / totals.total * 100) : 0 },
      byPlatform: reportData.filter(r => r.total > 0),
    };

    return {
      text: lines.join('\n'),
      json: jsonReport,
    };
  });
}
