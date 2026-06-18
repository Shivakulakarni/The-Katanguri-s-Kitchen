import http from 'k6/http';
import { check, sleep, group, rate, trend } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1500,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
    },
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { duration: '30s', target: 0 },
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
        { duration: '2m', target: 0 },
      ],
      startTime: '20m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['avg<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_PHONE = '+919876543210';
const DEV_OTP = '2563';
const DISH_IDS = [396, 397, 398, 399, 401, 402, 404, 407, 410, 411];

let authToken = '';

function getToken() {
  if (authToken) return authToken;
  const r = http.post(`${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phone: AUTH_PHONE, otp: DEV_OTP }),
    { headers: { 'Content-Type': 'application/json' } });
  if (r.status === 200) {
    try { const b = JSON.parse(r.body); authToken = b.token || b.accessToken; } catch {}
  }
  return authToken;
}

export default function () {
  const token = getToken();
  if (!token) { sleep(0.5); return; }

  group('full-flow', () => {
    let activeDishIds = [];
    const menu = http.get(`${BASE_URL}/api/v1/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(menu, { 'menu 200': (r) => r.status === 200 });

    if (menu.status === 200) {
      try {
        const categories = JSON.parse(menu.body) || [];
        activeDishIds = categories.flatMap((c) => (c.dishes || []).map((d) => d.id)).filter(Boolean);
      } catch (e) {}
    }

    const dishIdsToUse = activeDishIds.length > 0 ? activeDishIds : DISH_IDS;
    const dishId = dishIdsToUse[randomIntBetween(0, dishIdsToUse.length - 1)];
    const order = http.post(`${BASE_URL}/api/v1/orders`,
      JSON.stringify({ items: [{ dishId, quantity: randomIntBetween(1, 3) }] }),
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    check(order, { 'order 201': (r) => r.status === 200 || r.status === 201 });
  });

  sleep(randomIntBetween(0.3, 1.5));
}
