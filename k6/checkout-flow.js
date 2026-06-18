import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const email = `loadtest_${randomString(8)}@test.com`;
  const phone = `999999${Math.floor(1000 + Math.random() * 9000)}`;

  const signupRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
    name: 'Load Test User',
    email,
    phone,
    password: 'test123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(signupRes, { 'signup succeeded': (r) => r.status === 201 || r.status === 200 });

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email,
    password: 'test123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login succeeded': (r) => r.status === 200 });

  let token = '';
  try {
    token = loginRes.json('token') || '';
  } catch {}

  const menuRes = http.get(`${BASE_URL}/api/v1/menu`);
  check(menuRes, { 'menu fetched': (r) => r.status === 200 });

  let dishes = [];
  try {
    const categories = JSON.parse(menuRes.body) || [];
    dishes = categories.flatMap((c) => (c.dishes || []).map((d) => d));
  } catch {}

  if (dishes.length > 0) {
    const orderRes = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
      items: [{ dishId: dishes[0].id, quantity: 1 }],
    }), {
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    });
    check(orderRes, { 'order created': (r) => r.status === 200 || r.status === 201 });
  }

  sleep(1);
}
