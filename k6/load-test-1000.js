import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '3m', target: 500 },
        { duration: '3m', target: 800 },
        { duration: '2m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{type:order}': ['p(95)<1500'],
    'http_req_duration{type:menu}': ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_PHONE = '+919876543210';
const DEV_OTP = '2563';
const DISH_IDS = [396, 397, 398, 399, 400, 401, 402, 403, 404, 405];

let authToken = '';

function getAuthToken() {
  if (authToken) return authToken;

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    phone: AUTH_PHONE,
    otp: DEV_OTP,
  }), { headers: { 'Content-Type': 'application/json' }, tags: { type: 'auth' } });

  check(loginRes, { 'login succeeded': (r) => r.status === 200 });

  try {
    const body = JSON.parse(loginRes.body);
    authToken = body.token || body.accessToken || '';
  } catch {}
  return authToken;
}

export default function () {
  const token = getAuthToken();
  if (!token) {
    sleep(1);
    return;
  }

  let activeDishIds = [];

  group('Browse Menu', () => {
    const menuRes = http.get(`${BASE_URL}/api/v1/menu`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { type: 'menu' },
    });

    check(menuRes, { 'menu fetched': (r) => r.status === 200 });

    if (menuRes.status === 200) {
      try {
        const categories = JSON.parse(menuRes.body) || [];
        activeDishIds = categories.flatMap((c) => (c.dishes || []).map((d) => d.id)).filter(Boolean);
      } catch (e) {}
      sleep(randomIntBetween(0.5, 2));
    }
  });

  group('Place Order', () => {
    const dishIdsToUse = activeDishIds.length > 0 ? activeDishIds : DISH_IDS;
    const dishId = dishIdsToUse[randomIntBetween(0, dishIdsToUse.length - 1)];
    const quantity = randomIntBetween(1, 3);

    const orderRes = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
      items: [{ dishId, quantity }],
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      tags: { type: 'order' },
    });

    check(orderRes, {
      'order created': (r) => r.status === 200 || r.status === 201,
      'order has id': (r) => {
        try { return JSON.parse(r.body).id !== undefined; } catch { return false; }
      },
    });
  });

  sleep(randomIntBetween(0.5, 2));
}
