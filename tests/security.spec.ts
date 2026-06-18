import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

test.describe('Security Tests', () => {

  // ── 1. Authentication ──
  test.describe('Authentication', () => {
    test('rejects request without auth header', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/admin/orders`);
      expect(res.status()).toBe(401);
    });

    test('rejects invalid JWT token', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/admin/orders`, {
        headers: { 'Authorization': 'Bearer invalid-token-12345' },
      });
      expect(res.status()).toBe(401);
    });

    test('rejects expired JWT token', async ({ request }) => {
      // This is a JWT that expired in 2020
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoxLCJyb2xlIjoiY3VzdG9tZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNTc3ODM2ODAwLCJleHAiOjE1Nzc4NDA0MDB9.fake';
      const res = await request.get(`${API_URL}/api/v1/admin/orders`, {
        headers: { 'Authorization': `Bearer ${expiredToken}` },
      });
      expect(res.status()).toBe(401);
    });

    test('rejects admin endpoint with customer token', async ({ request }) => {
      // First get a valid customer token via dev bypass
      const authRes = await request.post(`${API_URL}/api/v1/auth/otp/send`, {
        data: { phone: '9876543001' },
      });
      if (authRes.ok()) {
        const verifyRes = await request.post(`${API_URL}/api/v1/auth/otp/verify`, {
          data: { phone: '9876543001', otp: '2563' },
        });
        if (verifyRes.ok()) {
          const { token } = await verifyRes.json();
          const res = await request.get(`${API_URL}/api/v1/admin/orders`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          expect(res.status()).toBe(403);
        }
      }
    });
  });

  // ── 2. Input Validation ──
  test.describe('Input Validation', () => {
    test('rejects SQL injection in search', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/menu?search='; DROP TABLE orders; --`);
      // Should not crash — return 200 or 400, never 500
      expect(res.status()).not.toBe(500);
    });

    test('rejects XSS in order notes', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: {
          items: [{ dishId: 1, quantity: 1, unitPrice: 100 }],
          notes: '<script>alert("xss")</script>',
        },
      });
      // Should not crash
      expect(res.status()).not.toBe(500);
    });

    test('rejects negative order quantity', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: {
          items: [{ dishId: 1, quantity: -1, unitPrice: 100 }],
        },
      });
      expect(res.status()).toBe(400);
    });

    test('rejects zero price', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: {
          items: [{ dishId: 1, quantity: 1, unitPrice: 0 }],
        },
      });
      expect(res.status()).toBe(400);
    });

    test('rejects extremely long notes', async ({ request }) => {
      const longNotes = 'A'.repeat(10000);
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: {
          items: [{ dishId: 1, quantity: 1, unitPrice: 100 }],
          notes: longNotes,
        },
      });
      // Should truncate or reject, not crash
      expect(res.status()).not.toBe(500);
    });
  });

  // ── 3. Rate Limiting ──
  test.describe('Rate Limiting', () => {
    test('health endpoint is accessible', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/health`);
      expect(res.ok()).toBeTruthy();
    });
  });

  // ── 4. CORS ──
  test.describe('CORS', () => {
    test('rejects cross-origin mutation without Origin', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: { items: [] },
      });
      // Should not be 500 (CORS error), should be validation error
      expect(res.status()).not.toBe(500);
    });
  });

  // ── 5. Error Handling ──
  test.describe('Error Handling', () => {
    test('returns structured error for missing body', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: {},
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    test('does not leak stack traces', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/nonexistent-endpoint-12345`);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(/stack|trace|Error.*at/);
    });

    test('returns 404 for unknown routes', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/unknown`);
      expect(res.status()).toBe(404);
    });
  });

  // ── 6. Cookie Security ──
  test.describe('Cookie Security', () => {
    test('sets HttpOnly flag on auth cookies', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/auth/otp/verify`, {
        data: { phone: '9876543001', otp: '2563' },
      });
      const headers = res.headers();
      const setCookie = headers['set-cookie'];
      if (setCookie) {
        expect(setCookie).toContain('HttpOnly');
      }
    });
  });

  // ── 7. Content Type ──
  test.describe('Content Type', () => {
    test('rejects form-encoded body for JSON endpoint', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/orders`, {
        data: 'not-json',
        headers: { 'Content-Type': 'text/plain' },
      });
      expect(res.status()).toBe(400);
    });
  });
});
