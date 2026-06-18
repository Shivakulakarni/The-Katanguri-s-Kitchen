import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency', true);
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Soak test: sustained load for 30 minutes to detect memory leaks and degradation
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // ramp up
    { duration: '26m', target: 50 },   // sustained load
    { duration: '2m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  // Mix of read and write operations (realistic traffic pattern)
  const scenario = Math.random();

  if (scenario < 0.6) {
    // 60% menu browsing
    const res = http.get(`${BASE_URL}/api/v1/menu`, {
      tags: { name: 'GET /api/v1/menu' },
    });
    check(res, { 'menu 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    latency.add(res.timings.duration);
  } else if (scenario < 0.8) {
    // 20% health checks
    const res = http.get(`${BASE_URL}/api/v1/health`, {
      tags: { name: 'GET /api/v1/health' },
    });
    check(res, { 'health 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    latency.add(res.timings.duration);
  } else {
    // 20% order creation
    const payload = {
      externalId: `SOAK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: 'soaktest',
      customerName: 'Soak Test',
      customerPhone: `98765${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
      customerAddress: '456 Soak Street',
      items: [{ dishId: 1, quantity: 1, unitPrice: 200, name: 'Soak Biryani', modifiers: [] }],
    };
    const res = http.post(`${BASE_URL}/api/v1/webhooks/swiggy`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/v1/webhooks/swiggy' },
    });
    check(res, { 'order created': (r) => r.status === 200 || r.status === 201 });
    errorRate.add(res.status !== 200 && res.status !== 201);
    latency.add(res.timings.duration);
  }

  sleep(Math.random() * 3 + 1);
}
