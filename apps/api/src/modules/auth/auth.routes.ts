import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomInt, timingSafeEqual } from 'crypto';
import { db } from '../../db/connection.js';
import { customers } from '../../db/schemas/customer.js';
import { eq } from 'drizzle-orm';
import { publishEvent } from '../../utils/eventBus.js';
import { supabaseAdmin } from '../../utils/supabase.js';
import { generateTokenPair, refreshTokens, revokeAllTokens } from '../../lib/refreshToken.js';
import { authenticate, isAccountLocked, recordFailedLogin, clearFailedLogins } from '../../middleware/auth.js';
import { validateBody } from '../../lib/validate.js';
import { loginSchema, registerSchema, otpRequestSchema, verifyOtpSchema, emailOtpSchema, emailVerifySchema, socialAuthSchema } from '../../lib/validation.js';
import {
  OTP_EXPIRY_SECONDS, OTP_PREFIX, OTP_RATE_LIMIT, LOGIN_RATE_LIMIT, AUTH_RATE_WINDOW_SECONDS,
} from '../../lib/constants.js';

import { redis } from '../../utils/redis.js';
import { logger } from '../../utils/logger.js';
import { sendSMS } from '../../services/sms.service.js';

function setAuthCookies(reply: any, accessToken: string, refreshToken: string) {
  reply.setCookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 900,
  });
  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth/refresh',
    maxAge: 2592000,
  });
}

function clearAuthCookies(reply: any) {
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set');
}

// In-memory rate limit fallback when Redis is unavailable (periodically evicted)
const inMemoryRateLimits = new Map<string, { count: number; resetAt: number }>();

// Evict expired entries every 60s to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemoryRateLimits) {
    if (now > entry.resetAt) inMemoryRateLimits.delete(key);
  }
}, 60000).unref();

async function checkAuthRateLimit(ip: string, max: number): Promise<boolean> {
  if (process.env.DISABLE_AUTH_RATE_LIMIT === 'true') {
    return true;
  }
  const key = `ratelimit:auth:${ip}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, AUTH_RATE_WINDOW_SECONDS);
    }
    return current <= max;
  } catch {
    // Redis unavailable — use in-memory fallback (fail closed, not open)
    const now = Date.now();
    const entry = inMemoryRateLimits.get(key);
    if (!entry || now > entry.resetAt) {
      inMemoryRateLimits.set(key, { count: 1, resetAt: now + AUTH_RATE_WINDOW_SECONDS * 1000 });
      return true;
    }
    entry.count++;
    return entry.count <= max;
  }
}

/** Constant-time string comparison to prevent timing attacks on OTP */
function safeOtpCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.from(a.padEnd(maxLen, '\0'));
  const bufB = Buffer.from(b.padEnd(maxLen, '\0'));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function getOtp(key: string): Promise<{ otp: string; expiresAt: number; phone: string } | null> {
  const raw = await redis.get(`${OTP_PREFIX}${key}`);
  return raw ? JSON.parse(raw) : null;
}

async function setOtp(key: string, data: { otp: string; expiresAt: number; phone: string }): Promise<void> {
  await redis.set(`${OTP_PREFIX}${key}`, JSON.stringify(data), 'EX', OTP_EXPIRY_SECONDS);
}

async function deleteOtp(key: string): Promise<void> {
  await redis.del(`${OTP_PREFIX}${key}`);
}

function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Helper: upsert customer in local DB after Supabase auth.
 * Links the Supabase user ID to our customers table.
 */
async function upsertCustomerFromSupabase(supabaseUser: any, extra?: { phone?: string; name?: string }) {
  const email = supabaseUser.email || null;
  const phone = extra?.phone || supabaseUser.phone || null;

  // Try finding by supabase user ID first, then by email, then by phone
  let [customer] = email
    ? await db.select().from(customers).where(eq(customers.email, email)).limit(1)
    : [];
  if (!customer && phone) {
    [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  }

  if (customer) {
    // Update name if missing
    if (!customer.name && (extra?.name || supabaseUser.user_metadata?.full_name)) {
      const name = extra?.name || supabaseUser.user_metadata?.full_name;
      const [updated] = await db.update(customers).set({ name }).where(eq(customers.id, customer.id)).returning();
      customer = updated;
    }
    return customer;
  }

  // Create new customer
  const [newCustomer] = await db.insert(customers).values({
    email,
    phone,
    name: extra?.name || supabaseUser.user_metadata?.full_name || null,
    isGuest: false,
  }).returning();
  await publishEvent('customer.created', { customer: newCustomer });
  return newCustomer;
}

export async function authRoutes(app: FastifyInstance) {
  // ── Register (phone-based with optional OTP) ──
  app.post('/api/v1/auth/register', async (request, reply) => {
    const body = await validateBody(request, reply, registerSchema);
    if (body === null) return;
    const { email, phone, name, password, otp } = body;

    const ip = request.ip;
    if (!(await checkAuthRateLimit(ip, LOGIN_RATE_LIMIT))) {
      logger.warn({ ip }, '[AUTH] Rate limit exceeded on register');
      return reply.status(429).send({ error: 'Too many requests. Please try again later.' });
    }

    // If Supabase is configured, use Supabase Auth
    if (supabaseAdmin) {
      // Phone + OTP registration via Supabase — fall through to local on failure
      if (phone && otp) {
        const { data, error } = await supabaseAdmin.auth.verifyOtp({ phone, token: otp, type: 'sms' });
        if (!error) {
          const customer = await upsertCustomerFromSupabase(data.user, { phone, name });
          const tokens = await generateTokenPair(customer.id, 'customer');
          setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
          return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
        }
        logger.warn({ err: error.message }, '[AUTH] Supabase register OTP failed, falling back to local');
      }

      // Email + password registration via Supabase
      if (email && password) {
        const { data, error } = await supabaseAdmin.auth.signUp({
          email,
          password,
          options: { data: { full_name: name || '' } },
        });
        if (error) return reply.status(400).send({ error: error.message });

        const customer = await upsertCustomerFromSupabase(data.user, { phone, name });
        const tokens = await generateTokenPair(customer.id, 'customer');
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
        return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
      }
    }

    // ── Fallback: Legacy local auth ──
    if (!phone) return reply.status(400).send({ error: 'Phone is required' });

    // Verify OTP if provided
    if (otp) {
      const stored = await getOtp(phone);
      if (!stored || !safeOtpCompare(stored.otp, otp)) {
        return reply.status(400).send({ error: 'Invalid or expired OTP' });
      }
      if (Date.now() > stored.expiresAt) {
        await deleteOtp(phone);
        return reply.status(400).send({ error: 'OTP has expired' });
      }
      await deleteOtp(phone);
    }

    const existing = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (existing.length) {
      const tokens = await generateTokenPair(existing[0].id, 'customer');
      setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
      return { ...tokens, user: { id: existing[0].id, name: existing[0].name, email: existing[0].email, phone: existing[0].phone, role: 'customer' } };
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const [customer] = await db.insert(customers).values({
      email: email || null, phone, name: name || null, passwordHash, isGuest: !password,
    }).returning();

    const tokens = await generateTokenPair(customer.id, 'customer');
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
  });

  // ── Refresh Token endpoint ──
  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const bodyToken = (request.body as any)?.refreshToken;
    const cookieToken = request.cookies?.refresh_token;
    const refreshToken = bodyToken || cookieToken;
    if (!refreshToken) return reply.status(400).send({ error: 'Refresh token required' });

    const tokens = await refreshTokens(refreshToken);
    if (!tokens) return reply.status(401).send({ error: 'Invalid or expired refresh token' });

    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return tokens;
  });

  // ── Logout (revoke all tokens) ──
  app.post('/api/v1/auth/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (user?.customerId) {
      await revokeAllTokens(user.customerId);
    }
    clearAuthCookies(reply);
    return { message: 'Logged out successfully' };
  });

  // ── Login (email+password OR phone+OTP) ──
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = await validateBody(request, reply, loginSchema);
    if (body === null) return;
    const { email, password, phone, otp } = body;

    // Rate limit: max 10 login attempts per 15 min per IP
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkAuthRateLimit(ip, LOGIN_RATE_LIMIT))) {
      return reply.status(429).send({ error: 'Too many login attempts. Please try again in 15 minutes.' });
    }

    // Account lockout check
    const lockoutIdentifier = email || phone || 'unknown';
    if (await isAccountLocked(lockoutIdentifier)) {
      return reply.status(423).send({ error: 'Account temporarily locked due to too many failed attempts. Please try again later.' });
    }

    // Supabase login
    if (supabaseAdmin) {
      // Phone + OTP login via Supabase
      if (phone && otp) {
        const { data, error } = await supabaseAdmin.auth.verifyOtp({ phone, token: otp, type: 'sms' });
        if (!error) {
          await clearFailedLogins(phone);
          const customer = await upsertCustomerFromSupabase(data.user, { phone });
          const userRole = customer?.role === 'admin' ? 'admin' : 'customer';
          const tokens = await generateTokenPair(customer.id, userRole);
          setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
          return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: userRole } };
        }
        logger.warn({ err: error.message }, '[AUTH] Supabase login OTP failed, falling back to local');
      }

      // Email + password login via Supabase
      if (email && password) {
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
        if (!error) {
          await clearFailedLogins(email);
          const customer = await upsertCustomerFromSupabase(data.user);
          const userRole = customer?.role === 'admin' ? 'admin' : 'customer';
          const tokens = await generateTokenPair(customer.id, userRole);
          setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
          return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: userRole } };
        }
        // Supabase failed — fall through to local auth
      }
    }

    // ── Fallback: Legacy local auth ──
    // Phone + OTP login
    if (phone && otp) {
      const stored = await getOtp(phone);
      if (!stored || !safeOtpCompare(stored.otp, otp)) {
        const isNowLocked = await recordFailedLogin(phone);
        return reply.status(401).send({ error: isNowLocked ? 'Account temporarily locked due to too many failed attempts.' : 'Invalid or expired OTP' });
      }
      if (Date.now() > stored.expiresAt) {
        await deleteOtp(phone);
        return reply.status(401).send({ error: 'OTP has expired' });
      }
      await deleteOtp(phone);
      await clearFailedLogins(phone);

      const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
      if (!customer) {
        const [newCustomer] = await db.insert(customers).values({ phone, isGuest: false }).returning();
        const tokens = await generateTokenPair(newCustomer.id, 'customer');
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
        return { ...tokens, user: { id: newCustomer.id, name: newCustomer.name, email: newCustomer.email, phone: newCustomer.phone, role: 'customer' } };
      }

      const existingRole = customer.role === 'admin' ? 'admin' : 'customer';
      const tokens = await generateTokenPair(customer.id, existingRole);
      setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
      return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: existingRole } };
    }

    // Email + password login
    if (!email || !password) return reply.status(400).send({ error: 'Email and password or phone and OTP required' });

    const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (!customer || !customer.passwordHash) {
      await recordFailedLogin(email);
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      const isNowLocked = await recordFailedLogin(email);
      return reply.status(401).send({ error: isNowLocked ? 'Account temporarily locked due to too many failed attempts.' : 'Invalid credentials' });
    }

    await clearFailedLogins(email);
    const emailRole = customer.role === 'admin' ? 'admin' : 'customer';
    const tokens = await generateTokenPair(customer.id, emailRole);
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: emailRole } };
  });

  // ── Send OTP ──
  app.post('/api/v1/auth/otp', async (request, reply) => {
    const body = await validateBody(request, reply, otpRequestSchema);
    if (body === null) return;
    const phone = body.phone;
    if (!phone) return reply.status(400).send({ error: 'Phone required' });

    // Rate limit: max 5 OTP requests per 15 min per IP
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkAuthRateLimit(ip, OTP_RATE_LIMIT))) {
      return reply.status(429).send({ error: 'Too many OTP requests. Please try again in 15 minutes.' });
    }

    // Supabase OTP — fall through to local on failure
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({ phone });
      if (!error) return { message: 'OTP sent to your phone' };
      logger.warn({ err: error.message }, '[AUTH] Supabase OTP failed, falling back to local OTP');
    }

    // Legacy OTP
    const otp = generateOtp();
    await setOtp(phone, { otp, expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000, phone });
    if (process.env.NODE_ENV !== 'production') logger.debug({ phone: phone.replace(/(\d{2})\d+(\d{2})/, '$1****$2') }, '[OTP] Sent OTP');
    
    // Send OTP via Twilio SMS
    const smsResult = await sendSMS(phone, `Your OTP for The Katanguri's Kitchen is ${otp}. Valid for 5 minutes.`);
    
    if (!smsResult.success) {
      logger.warn({ phone, error: smsResult.error }, '[AUTH] SMS delivery failed');
      return { 
        message: 'SMS delivery unavailable. Please use email OTP instead.', 
        smsFailed: true,
        _dev_otp: otp,
      };
    }

    return { message: 'OTP sent to your phone' };
  });

  // ── Admin Login (email + password with admin role) ──
  app.post('/api/v1/auth/admin/login', async (request, reply) => {
    const body = await validateBody(request, reply, loginSchema);
    if (body === null) return;
    const { email, password } = body;
    if (!email || !password) return reply.status(400).send({ error: 'Email and password required' });

    // Rate limit: max 5 admin login attempts per 15 min per IP
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkAuthRateLimit(ip, 5))) {
      return reply.status(429).send({ error: 'Too many admin login attempts. Please try again in 15 minutes.' });
    }

    // Supabase admin login
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (!error) {
        const customer = await upsertCustomerFromSupabase(data.user);
        // Check Supabase app_metadata first, then fall back to local DB role
        const isAdmin = data.user.app_metadata?.role === 'admin' || customer?.role === 'admin';
        const tokens = await generateTokenPair(customer.id, isAdmin ? 'admin' : 'customer');
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
        return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: isAdmin ? 'admin' : 'customer' } };
      }
      // Supabase failed — fall through to local auth
    }

    // Legacy admin login
    const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (!customer || !customer.passwordHash) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    // Check actual admin role — only users with role 'admin' can log in as admin
    if (customer.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied. Admin privileges required.' });
    }

    const tokens = await generateTokenPair(customer.id, 'admin');
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'admin' } };
  });

  // ── Verify OTP (standalone endpoint) ──
  app.post('/api/v1/auth/verify-otp', async (request, reply) => {
    const body = await validateBody(request, reply, verifyOtpSchema);
    if (body === null) return;
    const { phone, otp, name, email } = body;

    // Rate limit: max 5 verify-otp attempts per 15 min per IP
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkAuthRateLimit(ip, 5))) {
      return reply.status(429).send({ error: 'Too many OTP verification attempts. Please try again in 15 minutes.' });
    }

    // Supabase verify — fall through to local on failure
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (!error) {
        const customer = await upsertCustomerFromSupabase(data.user, { phone, name });
        const tokens = await generateTokenPair(customer.id, 'customer');
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
        return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
      }
      logger.warn({ err: error.message }, '[AUTH] Supabase verify OTP failed, falling back to local verify');
    }

    // Legacy verify
    const stored = await getOtp(phone);
    if (!stored || !safeOtpCompare(stored.otp, otp)) {
      return reply.status(400).send({ error: 'Invalid or expired OTP' });
    }
    if (Date.now() > stored.expiresAt) {
      await deleteOtp(phone);
      return reply.status(400).send({ error: 'OTP has expired' });
    }
    await deleteOtp(phone);

    let [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (!customer) {
      const [newCustomer] = await db.insert(customers).values({ phone, name: name || null, email: email || null, isGuest: false }).returning();
      customer = newCustomer;
      await publishEvent('customer.created', { customer });
    }

    const tokens = await generateTokenPair(customer.id, 'customer');
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
  });

  // ── Send Email OTP ──
  app.post('/api/v1/auth/email-otp', async (request, reply) => {
    const body = await validateBody(request, reply, emailOtpSchema);
    if (body === null) return;
    const { email } = body;

    // Rate limit
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkAuthRateLimit(ip, OTP_RATE_LIMIT))) {
      return reply.status(429).send({ error: 'Too many requests. Please try again in 15 minutes.' });
    }

    const otp = generateOtp();
    await setOtp(`email:${email}`, { otp, expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000, phone: email });

    if (process.env.NODE_ENV !== 'production') logger.debug({ email }, '[EMAIL OTP] Sent OTP');

    // Try sending via SendGrid
    let emailSent = false;
    try {
      const { sendOTP } = await import('../../services/email.service.js');
      emailSent = await sendOTP(email, otp, 'login');
    } catch (err: any) {
      logger.warn({ email, error: err?.message }, '[EMAIL OTP] SendGrid error');
    }

    if (!emailSent) {
      logger.warn({ email, otp }, '[EMAIL OTP] Email delivery failed — OTP logged for debugging');
    }

    return { message: 'OTP sent to your email', _dev_otp: emailSent ? undefined : otp };
  });

  // ── Verify Email OTP (login or register) ──
  app.post('/api/v1/auth/email-verify', async (request, reply) => {
    const body = await validateBody(request, reply, emailVerifySchema);
    if (body === null) return;
    const { email, otp, name } = body;

    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    if (!(await checkAuthRateLimit(ip, 5))) {
      return reply.status(429).send({ error: 'Too many verification attempts. Please try again in 15 minutes.' });
    }

    const key = `email:${email}`;
    const stored = await getOtp(key);
    if (!stored || !safeOtpCompare(stored.otp, otp)) {
      return reply.status(400).send({ error: 'Invalid or expired OTP' });
    }
    if (Date.now() > stored.expiresAt) {
      await deleteOtp(key);
      return reply.status(400).send({ error: 'OTP has expired' });
    }
    await deleteOtp(key);

    // Find or create customer by email
    let [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (!customer) {
      const [newCustomer] = await db.insert(customers).values({
        email, name: name || null, isGuest: false,
      }).returning();
      customer = newCustomer;
      await publishEvent('customer.created', { customer });
    } else if (!customer.name && name) {
      const [updated] = await db.update(customers).set({ name }).where(eq(customers.id, customer.id)).returning();
      customer = updated;
    }

    const tokens = await generateTokenPair(customer.id, 'customer');
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
  });

  // ── Social Login (requires Supabase OAuth) ──
  app.post('/api/v1/auth/social', async (request, reply) => {
    const body = await validateBody(request, reply, socialAuthSchema);
    if (body === null) return;
    const { email, name, accessToken } = body;

    // SECURITY: Social login requires Supabase for token verification.
    // Without it, anyone could impersonate any user by sending their email.
    if (!supabaseAdmin) {
      return reply.status(501).send({ error: 'Social login not available — Supabase not configured' });
    }

    if (!accessToken) {
      return reply.status(400).send({ error: 'accessToken required — authenticate via Supabase OAuth first' });
    }
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (error || !data.user || data.user.email !== email) {
        return reply.status(401).send({ error: 'Invalid or expired access token' });
      }
    } catch {
      return reply.status(401).send({ error: 'Token verification failed' });
    }

    let [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (!customer) {
      const [newCustomer] = await db.insert(customers).values({ email, name: name || null, isGuest: false }).returning();
      customer = newCustomer;
      await publishEvent('customer.created', { customer });
    } else if (!customer.name && name) {
      const [updated] = await db.update(customers).set({ name }).where(eq(customers.id, customer.id)).returning();
      customer = updated;
    }

    const tokens = await generateTokenPair(customer.id, 'customer');
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ...tokens, user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, role: 'customer' } };
  });
}
