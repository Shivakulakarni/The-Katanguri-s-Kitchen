import { FastifyRequest, FastifyReply } from 'fastify';
import * as jose from 'jose';
import { JwtPayload } from '../types/index.js';
import { db } from '../db/connection.js';
import { customers } from '../db/schemas/customer.js';
import { eq } from 'drizzle-orm';
import { redis } from '../utils/redis.js';
import { CUSTOMER_ID_CACHE_TTL, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_SECONDS } from '../lib/constants.js';
import { logger } from '../utils/logger.js';

// ── Account Lockout ──
const LOCKOUT_PREFIX = 'lockout:';

/** Check if an account is locked out due to failed login attempts */
export async function isAccountLocked(identifier: string): Promise<boolean> {
  try {
    const locked = await redis.get(`${LOCKOUT_PREFIX}${identifier}`);
    return locked !== null;
  } catch {
    return false; // Redis unavailable — fail open
  }
}

/** Record a failed login attempt. Returns true if account is now locked. */
export async function recordFailedLogin(identifier: string): Promise<boolean> {
  const key = `login_attempts:${identifier}`;
  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, LOCKOUT_DURATION_SECONDS);
    }
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await redis.set(`${LOCKOUT_PREFIX}${identifier}`, 'locked', 'EX', LOCKOUT_DURATION_SECONDS);
      logger.warn({ identifier, attempts }, '[SECURITY] Account locked due to failed login attempts');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Clear failed login attempts on successful authentication */
export async function clearFailedLogins(identifier: string): Promise<void> {
  try {
    await redis.del(`login_attempts:${identifier}`);
    await redis.del(`${LOCKOUT_PREFIX}${identifier}`);
  } catch {
    // Non-fatal
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    logger.fatal('[FATAL] JWT_SECRET is not set. Cannot start in production.');
    process.exit(1);
  }
  logger.fatal('[FATAL] JWT_SECRET not set. Set JWT_SECRET in .env');
  process.exit(1);
}
const ACCESS_SECRET = new TextEncoder().encode(JWT_SECRET);
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_KEY = SUPABASE_JWT_SECRET ? new TextEncoder().encode(SUPABASE_JWT_SECRET) : null;

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

const CUSTOMER_ID_CACHE_PREFIX = 'supabase_customer:';

/**
 * Resolve a Supabase user to a local customer ID (integer).
 * Looks up by email first, then phone. Caches result in Redis for 5 minutes.
 */
async function resolveLocalCustomerId(supabaseUser: { email?: string; phone?: string }): Promise<number | null> {
  const email = supabaseUser.email || null;
  const phone = supabaseUser.phone || null;
  const cacheKey = email ? `email:${email}` : phone ? `phone:${phone}` : null;

  // Check Redis cache first
  if (cacheKey) {
    try {
      const cached = await redis.get(`${CUSTOMER_ID_CACHE_PREFIX}${cacheKey}`);
      if (cached !== null) {
        const parsed = parseInt(cached);
        return isNaN(parsed) ? null : parsed;
      }
    } catch {
      // Redis unavailable — skip cache, query DB directly
    }
  }

  // Cache miss — query database
  let customerId: number | null = null;

  if (email) {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (customer) customerId = customer.id;
  }
  if (customerId === null && phone) {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (customer) customerId = customer.id;
  }

  // Cache the result — only cache found users to avoid blocking future registrations
  if (cacheKey && customerId !== null) {
    try {
      await redis.set(`${CUSTOMER_ID_CACHE_PREFIX}${cacheKey}`, customerId.toString(), 'EX', CUSTOMER_ID_CACHE_TTL);
    } catch {
      // Redis cache write failure is non-fatal
    }
  }

  return customerId;
}

/**
 * Authenticate request using Supabase JWT or legacy local JWT.
 * Tries Supabase token first (if configured), falls back to local JWT.
 * For Supabase users, resolves the UUID to a local integer customer ID.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Try cookie-based auth
  if (!token && request.cookies?.access_token) {
    token = request.cookies.access_token;
  }

  if (!token) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  // Try Supabase JWT first
  if (SUPABASE_KEY) {
    try {
      const { payload: decoded } = await jose.jwtVerify(token, SUPABASE_KEY, { algorithms: ['HS256'] });
      // Resolve Supabase UUID to local customer ID (integer)
      const localId = await resolveLocalCustomerId({
        email: decoded.email as string | undefined,
        phone: decoded.phone as string | undefined,
      });

      if (localId !== null) {
        // Read role from local DB, not Supabase app_metadata
        const [localCustomer] = await db.select({ role: customers.role })
          .from(customers).where(eq(customers.id, localId)).limit(1);
        (request as any).user = {
          customerId: localId,
          role: localCustomer?.role || (decoded as any).app_metadata?.role || 'customer',
        };
        return;
      }
      // Supabase user not in local DB — fall through to local JWT
    } catch {
      // Supabase token invalid — fall through to local JWT
    }
  }

  // Fallback: legacy local JWT
  try {
    const { payload: decoded } = await jose.jwtVerify(token, ACCESS_SECRET, { algorithms: ['HS256'] });
    (request as any).user = decoded as unknown as JwtPayload;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as JwtPayload;
  if (!user || user.role !== 'admin') {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}
