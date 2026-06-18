/**
 * Circuit Breaker Metrics — exposes circuit breaker state as Prometheus gauges
 * and provides a health check endpoint for monitoring dashboards.
 */

import { getAllCircuitBreakers } from './circuitBreaker.js';

/** Map circuit breaker state to a numeric value for Prometheus */
function stateToNumber(state: string): number {
  switch (state) {
    case 'closed': return 0;    // Normal operation
    case 'half_open': return 1; // Recovering
    case 'open': return 2;      // Failing
    default: return -1;
  }
}

/**
 * Get all circuit breaker health data for the /health endpoint.
 */
export function getCircuitBreakerHealth() {
  const breakers = getAllCircuitBreakers();
  const allOk = breakers.every(b => b.state !== 'open');

  return {
    status: allOk ? 'ok' : 'degraded',
    breakers: breakers.map(b => ({
      name: b.name,
      state: b.state,
      stateNumeric: stateToNumber(b.state),
      failures: b.failureCount,
      successes: b.successCount,
      lastFailure: b.lastFailureTime || null,
    })),
  };
}
