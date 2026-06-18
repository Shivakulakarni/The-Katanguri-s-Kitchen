import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Spike test: sudden traffic surge to test auto-scaling and circuit breakers
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // normal traffic
    { duration: '5s', target: 200 },   // sudden spike to 200 VUs
    { duration: '30s', target: 200 },  // sustain spike
    { duration: '5s', target: 10 },    // recover
    { duration: '30s', target: 10 },   // normal traffic again
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'],  // 99th under 3s even during spike
    errors: ['rate<0.05'],               // <5% error rate during spike
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/menu`, {
    tags: { name: 'GET /api/v1/menu' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  errorRate.add(res.status !== 200);
  sleep(Math.random() * 2 + 0.5);
}
