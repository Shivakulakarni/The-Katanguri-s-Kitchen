import { createDispatchAdapter } from './base.js';
import type { DispatchOrderRequest, DispatchOrderResponse, DispatchTrackingResponse } from './types.js';
import { logger } from '../../../utils/logger.js';

const log = logger.child({ module: 'dispatch-failover' });

interface ProviderHealth {
  provider: string;
  healthy: boolean;
  lastCheck: number;
  avgResponseTime: number; // ms
  failureCount: number;
  successCount: number;
  lastError?: string;
}

/**
 * Dispatch Provider Failover Manager
 * 
 * Monitors provider health and automatically switches between providers
 * based on response times and success rates.
 * 
 * Features:
 * - Health checks every 30 seconds
 * - Automatic failover on provider failure
 * - Response time-based provider selection
 * - Circuit breaker pattern (5 failures = disable for 60s)
 */
class DispatchFailoverManager {
  private providers = new Map<string, ProviderHealth>();
  private enabledProviders: string[] = [];
  private activeProvider: string = '';
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor() {
    // Default provider order (can be overridden by env)
    const providerOrder = (process.env.DISPATCH_FAILOVER_ORDER || 'dunzo,porter,shadowfax').split(',');
    this.enabledProviders = providerOrder.map(p => p.trim().toLowerCase()).filter(Boolean);
    this.activeProvider = process.env.DISPATCH_PROVIDER || this.enabledProviders[0] || '';
  }

  /**
   * Initialize health tracking for all providers
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Only track providers that actually have registered adapters
    const registeredProviders = this.enabledProviders.filter(p => {
      try {
        createDispatchAdapter(p);
        return true;
      } catch {
        log.warn({ provider: p }, '[Failover] Adapter not registered, skipping');
        return false;
      }
    });

    this.enabledProviders = registeredProviders;
    if (!this.activeProvider || !registeredProviders.includes(this.activeProvider)) {
      this.activeProvider = registeredProviders[0] || '';
    }

    for (const provider of this.enabledProviders) {
      this.providers.set(provider, {
        provider,
        healthy: true,
        lastCheck: 0,
        avgResponseTime: 0,
        failureCount: 0,
        successCount: 0,
      });
    }

    // Start health checks — use 5min interval to avoid spamming logs when APIs aren't configured
    // Reduce to 30s in production by setting DISPATCH_HEALTH_CHECK_INTERVAL_MS env var
    const intervalMs = parseInt(process.env.DISPATCH_HEALTH_CHECK_INTERVAL_MS || '300000', 10);
    this.healthCheckInterval = setInterval(() => this.runHealthChecks(), intervalMs);

    log.info({ providers: this.enabledProviders, active: this.activeProvider }, '[Failover] Initialized');
  }

  /**
   * Run health checks on all providers
   */
  private async runHealthChecks(): Promise<void> {
    for (const provider of this.enabledProviders) {
      const health = this.providers.get(provider);
      if (!health) continue;

      // Skip circuit-broken providers
      if (!health.healthy && health.failureCount >= 5) {
        const timeSinceLastFailure = Date.now() - health.lastCheck;
        if (timeSinceLastFailure < 60000) continue; // Wait 60s before retry
        
        // Reset circuit breaker
        health.healthy = true;
        health.failureCount = 0;
        log.info({ provider }, '[Failover] Circuit breaker reset');
      }

      const startTime = Date.now();
      try {
        const adapter = createDispatchAdapter(provider);
        // Simple health check - just verify the adapter can be created
        await adapter.getAvailableRiders({ lat: 17.9784, lng: 79.5941 }, 1);
        
        const responseTime = Date.now() - startTime;
        
        // Update health metrics
        health.lastCheck = Date.now();
        health.successCount++;
        health.avgResponseTime = health.avgResponseTime === 0
          ? responseTime
          : (health.avgResponseTime * 0.7) + (responseTime * 0.3); // EWMA
        
        // Reset failure count on success
        if (health.failureCount > 0) health.failureCount--;
        
        health.healthy = true;
      } catch (err: any) {
        health.lastCheck = Date.now();
        health.failureCount++;
        health.lastError = err.message;
        health.healthy = health.failureCount < 5;
        
        log.warn({ provider, error: err.message, failures: health.failureCount }, '[Failover] Health check failed');
      }
    }

    // Update active provider if needed
    this.updateActiveProvider();
  }

  /**
   * Select the best provider based on health and response times
   */
  private updateActiveProvider(): void {
    const healthyProviders = this.enabledProviders.filter(p => {
      const health = this.providers.get(p);
      return health && health.healthy;
    });

    if (healthyProviders.length === 0) {
      log.error('[Failover] All providers unhealthy!');
      return;
    }

    // Select provider with lowest response time
    const bestProvider = healthyProviders.reduce((best, current) => {
      const bestHealth = this.providers.get(best)!;
      const currentHealth = this.providers.get(current)!;
      
      // Prefer providers with lower response times
      if (currentHealth.avgResponseTime < bestHealth.avgResponseTime) {
        return current;
      }
      return best;
    }, healthyProviders[0]);

    if (bestProvider !== this.activeProvider) {
      log.info({ from: this.activeProvider, to: bestProvider }, '[Failover] Switching active provider');
      this.activeProvider = bestProvider;
      
      // Update env for other modules
      process.env.DISPATCH_PROVIDER = bestProvider;
    }
  }

  /**
   * Get the current active provider
   */
  getActiveProvider(): string {
    return this.activeProvider;
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): ProviderHealth[] {
    return Array.from(this.providers.values());
  }

  /**
   * Create an order with automatic failover
   */
  async createOrderWithFailover(request: DispatchOrderRequest): Promise<DispatchOrderResponse> {
    const providersToTry = [...this.enabledProviders];
    
    // Try active provider first
    const activeIdx = providersToTry.indexOf(this.activeProvider);
    if (activeIdx > 0) {
      providersToTry.splice(activeIdx, 1);
      providersToTry.unshift(this.activeProvider);
    }

    for (const provider of providersToTry) {
      const health = this.providers.get(provider);
      if (!health || !health.healthy) continue;

      const startTime = Date.now();
      try {
        const adapter = createDispatchAdapter(provider);
        const result = await adapter.createOrder(request);
        
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        health.lastCheck = Date.now();
        health.successCount++;
        health.avgResponseTime = health.avgResponseTime === 0
          ? responseTime
          : (health.avgResponseTime * 0.7) + (responseTime * 0.3);
        
        if (result.status === 'assigned') {
          log.info({ provider, orderId: request.orderId, responseTime }, '[Failover] Order created successfully');
          return { ...result, provider };
        }
        
        // If provider returned failed status, try next
        log.warn({ provider, orderId: request.orderId }, '[Failover] Provider returned failed status');
      } catch (err: any) {
        const responseTime = Date.now() - startTime;
        health.failureCount++;
        health.lastCheck = Date.now();
        health.lastError = err.message;
        health.healthy = health.failureCount < 5;
        
        log.warn({ provider, orderId: request.orderId, error: err.message, responseTime }, '[Failover] Order creation failed');
      }
    }

    // All providers failed
    return {
      dispatchId: `FAIL_${request.orderId}`,
      provider: 'none',
      status: 'failed',
    };
  }

  /**
   * Track an order with failover
   */
  async trackOrderWithFailover(dispatchId: string, provider?: string): Promise<DispatchTrackingResponse> {
    const providersToTry = provider ? [provider, ...this.enabledProviders.filter(p => p !== provider)] : this.enabledProviders;

    for (const prov of providersToTry) {
      const health = this.providers.get(prov);
      if (!health || !health.healthy) continue;

      try {
        const adapter = createDispatchAdapter(prov);
        const result = await adapter.trackOrder(dispatchId);
        
        health.lastCheck = Date.now();
        health.successCount++;
        
        return result;
      } catch (err: any) {
        health.failureCount++;
        health.lastCheck = Date.now();
        health.lastError = err.message;
        health.healthy = health.failureCount < 5;
        
        log.warn({ provider: prov, dispatchId, error: err.message }, '[Failover] Track failed');
      }
    }

    return { dispatchId, status: 'failed' };
  }

  /**
   * Stop health checks
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.initialized = false;
  }
}

// Singleton instance
export const failoverManager = new DispatchFailoverManager();
