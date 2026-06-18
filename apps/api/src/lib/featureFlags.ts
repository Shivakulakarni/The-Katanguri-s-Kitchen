/**
 * Feature Flags — in-memory with Redis fallback for distributed systems.
 * Supports gradual rollouts, A/B testing, and kill switches.
 *
 * Usage:
 *   import { isFeatureEnabled, getFeatureFlag } from '../lib/featureFlags.js';
 *   if (await isFeatureEnabled('new_checkout_flow', { customerId: 123 })) { ... }
 */

import { redis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'feature-flags' });

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  /** Percentage of users who see this flag (0-100) */
  rolloutPercentage: number;
  /** Optional: only enabled for these user IDs */
  allowedUsers?: number[];
  /** Optional: only enabled for these roles */
  allowedRoles?: string[];
  /** Optional: whitelist of user IDs (percentage ignored) */
  forceEnabled?: number[];
  /** Optional: blacklist of user IDs */
  forceDisabled?: number[];
  /** Description for documentation */
  description?: string;
  /** Timestamp when flag was created */
  createdAt: string;
  /** Timestamp when flag was last modified */
  updatedAt: string;
}

// ── Default flags ──
const DEFAULT_FLAGS: Record<string, Omit<FeatureFlag, 'createdAt' | 'updatedAt'>> = {
  'new_checkout_flow': {
    key: 'new_checkout_flow',
    enabled: true,
    rolloutPercentage: 100,
    description: 'New streamlined checkout flow',
  },
  'ai_recommendations': {
    key: 'ai_recommendations',
    enabled: true,
    rolloutPercentage: 100,
    description: 'AI-powered dish recommendations',
  },
  'dark_mode': {
    key: 'dark_mode',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Dark mode toggle (not yet implemented)',
  },
  'scheduled_orders': {
    key: 'scheduled_orders',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Schedule orders for future delivery',
  },
  'loyalty_program': {
    key: 'loyalty_program',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Customer loyalty points system',
  },
  'group_ordering': {
    key: 'group_ordering',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Group ordering with shared cart',
  },
};

const REDIS_PREFIX = 'feature_flag:';

// ── In-memory cache ──
const flagCache: Map<string, FeatureFlag> = new Map();
// eslint-disable-next-line prefer-const -- lastCacheRefresh is updated on each cache refresh
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 60_000; // refresh from Redis every 60s

/**
 * Check if a feature flag is enabled for a given context.
 */
export async function isFeatureEnabled(
  flagKey: string,
  context?: { customerId?: number; role?: string }
): Promise<boolean> {
  const flag = await getFeatureFlag(flagKey);
  if (!flag) return false;
  if (!flag.enabled) return false;

  // Force disabled users
  if (context?.customerId && flag.forceDisabled?.includes(context.customerId)) {
    return false;
  }

  // Force enabled users
  if (context?.customerId && flag.forceEnabled?.includes(context.customerId)) {
    return true;
  }

  // Role-based check
  if (context?.role && flag.allowedRoles?.includes(context.role)) {
    return true;
  }

  // Percentage-based rollout (deterministic hash)
  if (context?.customerId) {
    return context.customerId % 100 < flag.rolloutPercentage;
  }

  // No context = check if flag is globally enabled
  return flag.rolloutPercentage === 100;
}

/**
 * Get a feature flag definition.
 */
export async function getFeatureFlag(flagKey: string): Promise<FeatureFlag | null> {
  // Check in-memory cache first
  if (flagCache.has(flagKey) && Date.now() - lastCacheRefresh < CACHE_TTL_MS) {
    return flagCache.get(flagKey)!;
  }

  // Try Redis
  try {
    const raw = await redis.get(`${REDIS_PREFIX}${flagKey}`);
    if (raw) {
      const flag = JSON.parse(raw) as FeatureFlag;
      flagCache.set(flagKey, flag);
      lastCacheRefresh = Date.now();
      return flag;
    }
  } catch {
    // Redis unavailable
  }

  // Fall back to defaults
  const defaultFlag = DEFAULT_FLAGS[flagKey];
  if (defaultFlag) {
    const now = new Date().toISOString();
    const flag: FeatureFlag = { ...defaultFlag, createdAt: now, updatedAt: now };
    flagCache.set(flagKey, flag);
    return flag;
  }

  return null;
}

/**
 * Get all feature flags.
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  const flags: FeatureFlag[] = [];

  // Get from Redis
  try {
    const keys = await redis.keys(`${REDIS_PREFIX}*`);
    if (keys.length > 0) {
      const values = await redis.mget(...keys);
      for (const val of values) {
        if (val) flags.push(JSON.parse(val));
      }
    }
  } catch {
    // Redis unavailable
  }

  // Merge with defaults (Redis takes precedence)
  for (const [key, defaultDef] of Object.entries(DEFAULT_FLAGS)) {
    if (!flags.find(f => f.key === key)) {
      const now = new Date().toISOString();
      flags.push({ ...defaultDef, createdAt: now, updatedAt: now });
    }
  }

  return flags;
}

/**
 * Update a feature flag. Creates it if it doesn't exist.
 */
export async function setFeatureFlag(
  flagKey: string,
  updates: Partial<Omit<FeatureFlag, 'key' | 'createdAt' | 'updatedAt'>>
): Promise<FeatureFlag> {
  const existing = await getFeatureFlag(flagKey);
  const now = new Date().toISOString();

  const flag: FeatureFlag = {
    key: flagKey,
    enabled: updates.enabled ?? existing?.enabled ?? false,
    rolloutPercentage: updates.rolloutPercentage ?? existing?.rolloutPercentage ?? 0,
    allowedUsers: updates.allowedUsers ?? existing?.allowedUsers,
    allowedRoles: updates.allowedRoles ?? existing?.allowedRoles,
    forceEnabled: updates.forceEnabled ?? existing?.forceEnabled,
    forceDisabled: updates.forceDisabled ?? existing?.forceDisabled,
    description: updates.description ?? existing?.description,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    await redis.set(`${REDIS_PREFIX}${flagKey}`, JSON.stringify(flag), 'EX', 86400);
    flagCache.set(flagKey, flag);
    log.info({ flagKey, enabled: flag.enabled }, '[FeatureFlag] Updated');
  } catch {
    log.warn({ flagKey }, '[FeatureFlag] Failed to persist to Redis');
  }

  return flag;
}

/**
 * Delete a feature flag.
 */
export async function deleteFeatureFlag(flagKey: string): Promise<void> {
  try {
    await redis.del(`${REDIS_PREFIX}${flagKey}`);
    flagCache.delete(flagKey);
    log.info({ flagKey }, '[FeatureFlag] Deleted');
  } catch {
    log.warn({ flagKey }, '[FeatureFlag] Failed to delete from Redis');
  }
}

/**
 * Initialize default flags in Redis (idempotent).
 */
export async function initializeDefaultFlags(): Promise<void> {
  for (const [key, defaultDef] of Object.entries(DEFAULT_FLAGS)) {
    const existing = await redis.get(`${REDIS_PREFIX}${key}`).catch(() => null);
    if (!existing) {
      const now = new Date().toISOString();
      const flag: FeatureFlag = { ...defaultDef, createdAt: now, updatedAt: now };
      await redis.set(`${REDIS_PREFIX}${key}`, JSON.stringify(flag), 'EX', 86400).catch(() => {});
    }
  }
  log.info('[FeatureFlag] Default flags initialized');
}
