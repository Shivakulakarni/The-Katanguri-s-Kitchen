/**
 * Circuit Breaker — prevents cascading failures by stopping requests
 * to a failing downstream service for a configured duration.
 *
 * States: CLOSED (normal) → OPEN (failing, rejects requests) → HALF_OPEN (testing recovery)
 */

import { logger } from '../utils/logger.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number;
  /** Time in ms to wait before trying again (half-open) */
  resetTimeout?: number;
  /** Number of successful requests in half-open state before closing */
  successThreshold?: number;
  /** Optional callback when state changes */
  onStateChange?: (state: CircuitState, name: string) => void;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private _halfOpenTestPending = false;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly onStateChange?: (state: CircuitState, name: string) => void;

  constructor(name: string, options?: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.resetTimeout = options?.resetTimeout ?? 30_000;
    this.successThreshold = options?.successThreshold ?? 2;
    this.onStateChange = options?.onStateChange;
  }

  getState(): CircuitState {
    if (this.state === 'open') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.transitionTo('half_open');
      }
    }
    return this.state;
  }

  private transitionTo(newState: CircuitState) {
    const prev = this.state;
    this.state = newState;
    if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this._halfOpenTestPending = false;
    } else if (newState === 'half_open') {
      this.successCount = 0;
      this._halfOpenTestPending = false;
    }
    logger.info({ prev, next: newState, name: this.name }, '[CircuitBreaker] State changed');
    this.onStateChange?.(newState, this.name);
  }

  /** Check if a request is allowed through */
  canExecute(): boolean {
    const state = this.getState(); // triggers open→half_open transition check
    if (state === 'closed') return true;
    if (state === 'half_open') {
      // Only allow one test request in half_open state
      if (this._halfOpenTestPending) return false;
      this._halfOpenTestPending = true;
      return true;
    }
    return false; // open — reject
  }

  /** Record a successful call */
  recordSuccess() {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0;
    }
  }

  /** Record a failed call */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      // Failed during recovery — re-open
      this.transitionTo('open');
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('open');
    }
  }

  /** Execute a function through the circuit breaker */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      logger.warn({ name: this.name }, '[CircuitBreaker] Request rejected — circuit open');
      if (fallback) return fallback();
      throw new Error(`Circuit breaker "${this.name}" is open — service unavailable`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  /** Manually reset the circuit to closed state */
  reset() {
    this.transitionTo('closed');
  }

  /** Get current stats for monitoring */
  getStats() {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// ── Registry of circuit breakers for monitoring ──

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name)!;
}

export function getAllCircuitBreakers(): ReturnType<CircuitBreaker['getStats']>[] {
  return Array.from(breakers.values()).map(b => b.getStats());
}
