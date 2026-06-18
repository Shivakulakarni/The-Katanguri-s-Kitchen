import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──
const errorRate = new Rate('errors');
const orderDuration = new Trend('order_duration', true);
const menuDuration = new Trend('menu_duration', true);

// ── Configuration ──
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_SECRET = __ENV.API_SECRET || '';

export const options = {
  scenarios: {
    // Scenario 1: Menu browsing (read-heavy, ~80% of traffic)
    menu_browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // ramp up
        { duration: '1m', target: 100 },   // sustain
        { duration: '30s', target: 0 },    // ramp down
      ],
      exec: 'browseMenu',
    },
    // Scenario 2: Order placement (write-heavy, critical path)
    order_placement: {
      executor: 'constant-vus',
      vUs: 10,
      duration: '2m',
      exec: 'placeOrder',
    },
    // Scenario 3: Health check (always-on monitoring)
    health_check: {
      executor: 'constant-vus',
      vUs: 5,
      duration: '3m',
      exec: 'healthCheck',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95th < 500ms, 99th < 1s
    errors: ['rate<0.01'],                             // <1% error rate
    menu_duration: ['p(95)<300'],                      // Menu loads < 300ms
    order_duration: ['p(95)<2000'],                    // Orders < 2s
  },
};

// ── Helper: generate random phone ──
function randomPhone() {
  return `98765${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
}

// ── Scenario: Menu Browsing ──
export function browseMenu() {
  const res = http.get(`${BASE_URL}/api/v1/menu`, {
    tags: { name: 'GET /api/v1/menu' },
  });

  check(res, {
    'menu status 200': (r) => r.status === 200,
    'menu has categories': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return Array.isArray(body) && body.length > 0;
      } catch { return false; }
    },
  });

  menuDuration.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  sleep(1);
}

// ── Scenario: Order Placement ──
export function placeOrder() {
  // Step 1: Create order (webhook-style, no auth needed)
  const orderPayload = {
    externalId: `LOAD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'loadtest',
    customerName: 'Load Test User',
    customerPhone: randomPhone(),
    customerAddress: '123 Test Street, Warangal',
    items: [
      { dishId: 1, quantity: 1, unitPrice: 250, name: 'Test Biryani', modifiers: [] },
    ],
  };

  const orderRes = http.post(`${BASE_URL}/api/v1/webhooks/swiggy`, JSON.stringify(orderPayload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/v1/webhooks/swiggy' },
  });

  const orderOk = check(orderRes, {
    'order created': (r) => r.status === 200 || r.status === 201,
    'order has id': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.orderId || body.success;
      } catch { return false; }
    },
  });

  orderDuration.add(orderRes.timings.duration);
  errorRate.add(!orderOk);

  sleep(2);

  // Step 2: Check health
  const healthRes = http.get(`${BASE_URL}/api/v1/health`, {
    tags: { name: 'GET /api/v1/health' },
  });

  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health db ok': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.checks?.database?.status === 'ok';
      } catch { return false; }
    },
  });
}

// ── Scenario: Health Check ──
export function healthCheck() {
  const res = http.get(`${BASE_URL}/api/v1/health`, {
    tags: { name: 'GET /api/v1/health' },
  });

  check(res, {
    'health status 200': (r) => r.status === 200,
    'health not shutting down': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.status !== 'shutting_down';
      } catch { return false; }
    },
  });

  errorRate.add(res.status !== 200);
  sleep(5);
}
