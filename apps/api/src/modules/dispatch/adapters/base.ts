import type { DispatchProviderAdapter } from './types.js';
import { withCircuitBreaker } from './circuitBreakerWrapper.js';

// Provider adapters registry
const adapters = new Map<string, () => DispatchProviderAdapter>();

// Cache circuit-breaker-wrapped adapters so each provider gets one instance
const wrappedAdapters = new Map<string, DispatchProviderAdapter>();

export function registerAdapter(name: string, factory: () => DispatchProviderAdapter): void {
  adapters.set(name.toLowerCase(), factory);
}

/**
 * Create a dispatch adapter for the given provider.
 * All adapters are automatically wrapped with circuit breaker protection
 * to prevent cascading failures when external delivery APIs are down.
 */
export function createDispatchAdapter(name?: string): DispatchProviderAdapter {
  const providerName = (name || process.env.DISPATCH_PROVIDER || '').toLowerCase();
  const factory = adapters.get(providerName);
  if (!factory) {
    throw new Error(`Unknown dispatch provider: ${providerName}. Available: ${Array.from(adapters.keys()).join(', ')}`);
  }

  // Return cached wrapped adapter if available
  const cached = wrappedAdapters.get(providerName);
  if (cached) return cached;

  // Wrap the adapter with circuit breaker protection
  const rawAdapter = factory();
  const wrappedAdapter = withCircuitBreaker(rawAdapter);
  wrappedAdapters.set(providerName, wrappedAdapter);
  return wrappedAdapter;
}

/**
 * Get all registered provider names.
 */
export function getRegisteredProviders(): string[] {
  return Array.from(adapters.keys());
}
