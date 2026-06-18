/**
 * Sentry Errors Admin Routes — allows admins to view recent
 * Sentry errors from the admin dashboard.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { fetchRecentSentryErrors } from '../../utils/sentryErrors.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'sentry-errors-routes' });

export async function sentryErrorsRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/sentry-errors
   * Fetch recent unresolved errors from Sentry.
   * Query params: project, environment, query, limit
   */
  app.get('/api/v1/admin/sentry-errors', {
    preHandler: [authenticate, requireAdmin],
  }, async (_request: any, _reply: any) => {
    const query = _request.query as Record<string, string | undefined>;

    const result = await fetchRecentSentryErrors({
      project: query.project,
      environment: query.environment,
      query: query.query,
      limit: query.limit ? parseInt(query.limit, 10) : 25,
    });

    log.info({ count: result.errors.length }, '[Admin] Fetched Sentry errors');
    return result;
  });

  /**
   * GET /api/v1/admin/sentry-errors/summary
   * Get a summary of error counts by level for the last 24h.
   */
  app.get('/api/v1/admin/sentry-errors/summary', {
    preHandler: [authenticate, requireAdmin],
  }, async (_request: any, _reply: any) => {
    const result = await fetchRecentSentryErrors({ limit: 100 });

    const byLevel: Record<string, number> = {};
    let totalCount = 0;

    for (const err of result.errors) {
      byLevel[err.level] = (byLevel[err.level] || 0) + 1;
      totalCount += err.count;
    }

    return {
      totalErrors: totalCount,
      uniqueIssues: result.errors.length,
      byLevel,
      timestamp: result.timestamp,
    };
  });
}
