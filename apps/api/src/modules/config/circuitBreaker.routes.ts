/**
 * Circuit Breaker Admin Routes — allows admins to view and manage
 * circuit breaker state from the admin dashboard.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { getAllCircuitBreakers, getCircuitBreaker } from '../../lib/circuitBreaker.js';
import { failoverManager } from '../dispatch/adapters/failover.js';
import { getRegisteredProviders } from '../dispatch/adapters/base.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'circuit-breaker-routes' });

export async function circuitBreakerRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/circuit-breakers
   * List all circuit breakers with their current state and stats.
   */
  app.get('/api/v1/admin/circuit-breakers', {
    preHandler: [authenticate, requireAdmin],
  }, async () => {
    const breakers = getAllCircuitBreakers();
    const dispatchProviders = getRegisteredProviders();
    const dispatchHealth = failoverManager.getHealthStatus();

    return {
      circuitBreakers: breakers,
      dispatch: {
        providers: dispatchProviders,
        activeProvider: failoverManager.getActiveProvider(),
        health: dispatchHealth,
      },
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * POST /api/v1/admin/circuit-breakers/:name/reset
   * Manually reset a circuit breaker to closed state.
   */
  app.post('/api/v1/admin/circuit-breakers/:name/reset', {
    preHandler: [authenticate, requireAdmin],
  }, async (_request: any, _reply: any) => {
    const { name } = _request.params as { name: string };
    const breaker = getCircuitBreaker(name);
    const prevState = breaker.getState();
    breaker.reset();

    log.info({ name, prevState }, '[Admin] Circuit breaker manually reset');
    return { success: true, name, previousState: prevState, currentState: 'closed' };
  });

  /**
   * POST /api/v1/admin/circuit-breakers/dispatch/reset-all
   * Reset all dispatch circuit breakers at once.
   */
  app.post('/api/v1/admin/circuit-breakers/dispatch/reset-all', {
    preHandler: [authenticate, requireAdmin],
  }, async () => {
    const breakers = getAllCircuitBreakers();
    const dispatchBreakers = breakers.filter(b => b.name.startsWith('dispatch:'));

    for (const b of dispatchBreakers) {
      const breaker = getCircuitBreaker(b.name);
      breaker.reset();
    }

    log.info({ count: dispatchBreakers.length }, '[Admin] All dispatch circuit breakers reset');
    return { success: true, reset: dispatchBreakers.length };
  });
}
