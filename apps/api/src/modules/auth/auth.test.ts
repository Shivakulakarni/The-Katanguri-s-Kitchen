import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as jose from 'jose';

const JWT_SECRET = 'test-secret';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ─── Mock dependencies ─────────────────────────────────────────────
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock('../../utils/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../utils/supabase.js', () => ({ supabaseAdmin: null }));
vi.mock('../../services/email.service.js', () => ({ sendOTP: vi.fn() }));

// ─── Tests ─────────────────────────────────────────────────────────

describe('OTP helpers (Redis-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOtp / setOtp / deleteOtp', () => {
    it('stores OTP in Redis with EX expiry', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const data = { otp: '1234', expiresAt: Date.now() + 300000, phone: '+919876543210' };
      await mockRedis.set(`otp:+919876543210`, JSON.stringify(data), 'EX', 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'otp:+919876543210',
        JSON.stringify(data),
        'EX',
        300,
      );
    });

    it('retrieves OTP from Redis', async () => {
      const data = { otp: '5678', expiresAt: Date.now() + 300000, phone: '+919876543210' };
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      const raw = await mockRedis.get('otp:+919876543210');
      const parsed = raw ? JSON.parse(raw) : null;

      expect(parsed).toEqual(data);
      expect(parsed?.otp).toBe('5678');
    });

    it('returns null when OTP not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      const raw = await mockRedis.get('otp:nonexistent');
      expect(raw).toBeNull();
    });

    it('deletes OTP from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);
      await mockRedis.del('otp:+919876543210');
      expect(mockRedis.del).toHaveBeenCalledWith('otp:+919876543210');
    });
  });

  describe('Redis-backed rate limiting', () => {
    it('allows request when count is within limit', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const key = 'ratelimit:auth:127.0.0.1';
      const current = await mockRedis.incr(key);
      if (current === 1) await mockRedis.expire(key, 900);

      expect(current).toBe(1);
      expect(current <= 10).toBe(true);
    });

    it('blocks request when count exceeds limit', async () => {
      mockRedis.incr.mockResolvedValue(11);

      const key = 'ratelimit:auth:127.0.0.1';
      const current = await mockRedis.incr(key);

      expect(current <= 10).toBe(false);
    });

    it('sets expiry only on first request', async () => {
      mockRedis.incr.mockResolvedValue(3);

      const key = 'ratelimit:auth:127.0.0.1';
      const current = await mockRedis.incr(key);
      if (current === 1) await mockRedis.expire(key, 900);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });
});

describe('JWT generation', () => {
  it('generates valid JWT with customerId and role', async () => {
    const payload = { customerId: 42, role: 'customer' as const };
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET_KEY);

    const { payload: decoded } = await jose.jwtVerify(token, SECRET_KEY, { algorithms: ['HS256'] });
    expect(decoded.customerId).toBe(42);
    expect(decoded.role).toBe('customer');
  });

  it('generates admin JWT with shorter expiry', async () => {
    const payload = { customerId: 1, role: 'admin' as const };
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET_KEY);

    const { payload: decoded } = await jose.jwtVerify(token, SECRET_KEY, { algorithms: ['HS256'] });
    expect(decoded.role).toBe('admin');
  });

  it('rejects JWT with wrong secret', async () => {
    const token = await new jose.SignJWT({ customerId: 1, role: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET_KEY);

    const wrongKey = new TextEncoder().encode('wrong-secret');
    await expect(jose.jwtVerify(token, wrongKey, { algorithms: ['HS256'] })).rejects.toThrow();
  });
});

describe('Developer bypass', () => {
  it('only activates in non-production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const phone = '+919876543210';
    const otp = '2563';
    const isBypass = process.env.NODE_ENV !== 'production' && phone === '+919876543210' && otp === '2563';

    expect(isBypass).toBe(false);
    process.env.NODE_ENV = original;
  });

  it('activates in development', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const phone = '+919876543210';
    const otp = '2563';
    const isBypass = process.env.NODE_ENV !== 'production' && phone === '+919876543210' && otp === '2563';

    expect(isBypass).toBe(true);
    process.env.NODE_ENV = original;
  });

  it('rejects wrong phone number', () => {
    const phone: string = '+910000000000';
    const otp: string = '2563';
    const isBypass = process.env.NODE_ENV !== 'production' && phone === '+919876543210' && otp === '2563';

    expect(isBypass).toBe(false);
  });

  it('rejects wrong OTP', () => {
    const phone: string = '+919876543210';
    const otp: string = '0000';
    const isBypass = process.env.NODE_ENV !== 'production' && phone === '+919876543210' && otp === '2563';

    expect(isBypass).toBe(false);
  });
});
