/**
 * Dispatch Circuit Breaker — wraps each dispatch adapter call with circuit breaker protection.
 * Prevents cascading failures when external delivery APIs (Porter, Dunzo, Shadowfax) are down.
 *
 * Integrates with the existing CircuitBreaker from lib/circuitBreaker.ts.
 */

import { getCircuitBreaker, type CircuitState } from '../../../lib/circuitBreaker.js';
import { logger } from '../../../utils/logger.js';
import type {
  DispatchProviderAdapter,
  DispatchOrderRequest,
  DispatchOrderResponse,
  DispatchTrackingResponse,
  DispatchCancelResponse,
  DispatchRider,
} from './types.js';

const log = logger.child({ module: 'dispatch-circuit-breaker' });

/**
 * Wraps a dispatch provider adapter with circuit breaker protection.
 * If the circuit is open (too many failures), requests are rejected immediately
 * without hitting the external API, and a fallback result is returned.
 */
export function withCircuitBreaker(adapter: DispatchProviderAdapter): DispatchProviderAdapter {
  const breaker = getCircuitBreaker(`dispatch:${adapter.provider}`, {
    failureThreshold: 5,
    resetTimeout: 60_000,    // Try again after 60s
    successThreshold: 2,     // 2 successes to close circuit
    onStateChange: (state: CircuitState, breakerName: string) => {
      log.warn({ provider: adapter.provider, state, breaker: breakerName }, '[CircuitBreaker] Dispatch state changed');
    },
  });

  const fallbackOrder = (orderId: string | number): DispatchOrderResponse => ({
    dispatchId: `CIRCUIT_OPEN_${orderId}`,
    provider: adapter.provider,
    status: 'failed',
    raw: { error: 'Circuit breaker open — provider temporarily unavailable', circuitState: breaker.getState() },
  });

  const fallbackTracking = (dispatchId: string): DispatchTrackingResponse => ({
    dispatchId,
    status: 'failed',
    raw: { error: 'Circuit breaker open' },
  });

  const fallbackCancel = (): DispatchCancelResponse => ({
    success: false,
    raw: { error: 'Circuit breaker open' },
  });

  return {
    ...adapter,

    async createOrder(request: DispatchOrderRequest): Promise<DispatchOrderResponse> {
      return breaker.execute(
        () => adapter.createOrder(request),
        () => Promise.resolve(fallbackOrder(request.orderId)),
      );
    },

    async trackOrder(dispatchId: string): Promise<DispatchTrackingResponse> {
      return breaker.execute(
        () => adapter.trackOrder(dispatchId),
        () => Promise.resolve(fallbackTracking(dispatchId)),
      );
    },

    async cancelOrder(dispatchId: string, reason?: string): Promise<DispatchCancelResponse> {
      return breaker.execute(
        () => adapter.cancelOrder(dispatchId, reason),
        () => Promise.resolve(fallbackCancel()),
      );
    },

    async getAvailableRiders(location: { lat: number; lng: number }, radiusKm?: number): Promise<DispatchRider[]> {
      return breaker.execute(
        () => adapter.getAvailableRiders(location, radiusKm),
        () => Promise.resolve([]),
      );
    },
  };
}
