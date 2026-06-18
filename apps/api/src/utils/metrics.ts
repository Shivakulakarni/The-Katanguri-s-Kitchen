import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// ── Counters ──
export const requestsTotal = new Counter({
  name: 'kitchen_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const requests5xx = new Counter({
  name: 'kitchen_requests_5xx',
  help: 'Total number of 5xx responses',
  labelNames: ['method', 'route'] as const,
  registers: [register],
});

export const ordersCreated = new Counter({
  name: 'kitchen_orders_created_total',
  help: 'Total number of orders created',
  registers: [register],
});

export const paymentsProcessed = new Counter({
  name: 'kitchen_payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['status'] as const,
  registers: [register],
});

// ── Histograms ──
export const requestDuration = new Histogram({
  name: 'kitchen_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
});

// ── Gauges ──
export const sseClientsGauge = new Gauge({
  name: 'kitchen_sse_clients',
  help: 'Current number of connected SSE clients',
  registers: [register],
});

export const uptimeGauge = new Gauge({
  name: 'kitchen_uptime_seconds',
  help: 'Server uptime in seconds',
  registers: [register],
});

export const dbPoolTotal = new Gauge({
  name: 'kitchen_db_pool_total',
  help: 'Total number of database connections in the pool',
  registers: [register],
});

export const dbPoolIdle = new Gauge({
  name: 'kitchen_db_pool_idle',
  help: 'Number of idle database connections in the pool',
  registers: [register],
});

export const dbPoolWaiting = new Gauge({
  name: 'kitchen_db_pool_waiting',
  help: 'Number of database connections waiting to be acquired',
  registers: [register],
});

// Update uptime every 10 seconds
setInterval(() => {
  uptimeGauge.set(process.uptime());
}, 10000);

// ── Legacy API (backward-compatible wrappers) ──
export function incrementCounter(name: string, by: number = 1) {
  if (name === 'requests_total') {
    requestsTotal.inc(by);
  } else if (name === 'requests_5xx') {
    requests5xx.inc(by);
  }
}

export function observeTiming(name: string, durationMs: number) {
  // Extract status code from name like "request_200"
  const match = name.match(/^request_(\d+)$/);
  if (match) {
    requestDuration.observe({ method: 'http', route: 'all', status_code: match[1] }, durationMs);
  }
}

export function getMetricsText(): Promise<string> {
  return register.metrics();
}

export function getMetricsContentType(): string {
  return register.contentType;
}
