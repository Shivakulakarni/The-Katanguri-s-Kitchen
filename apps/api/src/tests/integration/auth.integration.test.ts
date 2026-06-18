import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, redis, setupDatabase, teardown, cleanupDatabase } from './setup.js';
import { customers } from '../../db/schemas/customer.js';
import { eq } from 'drizzle-orm';
import * as jose from 'jose';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const JWT_SECRET = process.env.JWT_SECRET || 'test-integration-secret';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

describeDb('Auth Integration Tests', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('can create a customer and generate JWT', async () => {
    const [customer] = await db.insert(customers).values({
      phone: '+919999999100',
      name: 'TEST:Auth Customer',
      email: 'test-auth@test.local',
      role: 'customer',
    }).returning();

    expect(customer).toBeDefined();
    expect(customer.id).toBeGreaterThan(0);

    // Generate a JWT for this customer
    const token = await new jose.SignJWT({
      customerId: customer.id,
      role: customer.role,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(SECRET_KEY);

    // Verify the token
    const { payload } = await jose.jwtVerify(token, SECRET_KEY, { algorithms: ['HS256'] });
    expect(payload.customerId).toBe(customer.id);
    expect(payload.role).toBe('customer');
  });

  it('Redis OTP storage and retrieval', async () => {
    const phone = '+919999999101';
    const otp = '123456';
    const otpData = JSON.stringify({
      otp,
      expiresAt: Date.now() + 300000,
      phone,
    });

    // Store OTP
    await redis.set(`test:otp:${phone}`, otpData, 'EX', 300);

    // Retrieve OTP
    const stored = await redis.get(`test:otp:${phone}`);
    expect(stored).toBeDefined();

    const parsed = JSON.parse(stored!);
    expect(parsed.otp).toBe(otp);
    expect(parsed.phone).toBe(phone);

    // Verify TTL exists
    const ttl = await redis.ttl(`test:otp:${phone}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('Redis rate limiting works', async () => {
    const key = 'test:rate_limit:test_endpoint';

    // Increment rate limit counter
    for (let i = 0; i < 5; i++) {
      await redis.incr(key);
    }
    await redis.expire(key, 60);

    const count = await redis.get(key);
    expect(parseInt(count!)).toBe(5);

    // Check if rate limited
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
  });

  it('Redis token revocation', async () => {
    const customerId = 999;
    const tokenId = 'test-token-id-123';

    // Store refresh token
    await redis.hset(`test:refresh_token:${customerId}`, tokenId, 'test-refresh-token');

    // Verify it exists
    const stored = await redis.hget(`test:refresh_token:${customerId}`, tokenId);
    expect(stored).toBe('test-refresh-token');

    // Revoke
    await redis.hdel(`test:refresh_token:${customerId}`, tokenId);

    // Verify it's gone
    const revoked = await redis.hget(`test:refresh_token:${customerId}`, tokenId);
    expect(revoked).toBeNull();
  });

  it('customer role can be admin', async () => {
    const [admin] = await db.insert(customers).values({
      phone: '+919999999102',
      name: 'TEST:Admin Customer',
      email: 'test-admin@test.local',
      role: 'admin',
    }).returning();

    expect(admin.role).toBe('admin');

    const [found] = await db.select().from(customers)
      .where(eq(customers.id, admin.id));
    expect(found.role).toBe('admin');
  });

  it('OTP expires correctly in Redis', async () => {
    const phone = '+919999999103';

    // Store OTP with 1 second TTL
    await redis.set(`test:otp:${phone}`, JSON.stringify({
      otp: '999999',
      expiresAt: Date.now() + 1000,
      phone,
    }), 'EX', 1);

    // Should exist immediately
    const immediate = await redis.get(`test:otp:${phone}`);
    expect(immediate).toBeDefined();

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Should be gone
    const expired = await redis.get(`test:otp:${phone}`);
    expect(expired).toBeNull();
  });
});
