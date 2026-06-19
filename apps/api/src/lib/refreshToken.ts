import * as jose from 'jose';
import { redis } from '../utils/redis.js';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set');
}
// TypeScript: process.exit guarantees these are defined
const ACCESS_SECRET: string = JWT_SECRET;
const REFRESH_SECRET: string = JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const REFRESH_STORE_PREFIX = 'refresh_token:';
const REFRESH_STORE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const SECRET_KEY = new TextEncoder().encode(ACCESS_SECRET);
const REFRESH_KEY = new TextEncoder().encode(REFRESH_SECRET);

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  customerId: number;
  role: string;
  type: 'access' | 'refresh';
  tokenId?: string;
}

/**
 * Generate an access + refresh token pair.
 * The refresh token is stored in Redis using HSET for O(1) lookups
 * instead of KEYS scan which is O(N) and dangerous at scale.
 *
 * Redis structure: refresh_token:{customerId} -> { tokenId: refreshToken, ... }
 * TTL is set on the hash key itself.
 */
export async function generateTokenPair(customerId: number, role: string): Promise<TokenPair> {
  const tokenId = randomUUID();

  const accessToken = await new jose.SignJWT({ customerId, role, type: 'access' } satisfies TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(SECRET_KEY);

  const refreshToken = await new jose.SignJWT({ customerId, role, type: 'refresh', tokenId } satisfies TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(REFRESH_KEY);

  // Store refresh token in Redis hash for O(1) lookups
  const hashKey = `${REFRESH_STORE_PREFIX}${customerId}`;

  try {
    await redis.hset(hashKey, tokenId, refreshToken);
    await redis.expire(hashKey, REFRESH_STORE_TTL);
  } catch {
    // Redis unavailable — token won't be revocable but auth still works
  }

  return { accessToken, refreshToken };
}

/**
 * Verify a refresh token and generate a new token pair.
 * Returns null if the token is invalid or revoked.
 */
export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  try {
    const { payload } = await jose.jwtVerify(refreshToken, REFRESH_KEY, { algorithms: ['HS256'] });
    const decoded = payload as unknown as TokenPayload;
    if (decoded.type !== 'refresh') return null;

    const tokenId = decoded.tokenId;
    if (!tokenId) return null; // Old-format tokens without tokenId are rejected

    const hashKey = `${REFRESH_STORE_PREFIX}${decoded.customerId}`;

    // O(1) lookup — check if this specific token exists in the hash
    const stored = await redis.hget(hashKey, tokenId).catch(() => null);
    if (stored !== refreshToken) return null; // Token revoked or not found

    // Revoke the old token before generating new ones (prevents token reuse)
    await redis.hdel(hashKey, tokenId).catch(() => {});

    // Generate new token pair
    return generateTokenPair(decoded.customerId, decoded.role);
  } catch {
    return null;
  }
}

/**
 * Revoke all refresh tokens for a user (e.g., on logout or password change).
 * Simply delete the entire hash — O(1) operation.
 */
export async function revokeAllTokens(customerId: number): Promise<void> {
  await redis.del(`${REFRESH_STORE_PREFIX}${customerId}`).catch(() => {});
}

/**
 * Revoke a single refresh token (used after rotation).
 */
export async function revokeRefreshToken(customerId: number, tokenId: string): Promise<void> {
  await redis.hdel(`${REFRESH_STORE_PREFIX}${customerId}`, tokenId).catch(() => {});
}
