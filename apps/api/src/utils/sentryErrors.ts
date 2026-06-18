/**
 * Sentry Errors API — fetches recent errors from Sentry's API
 * for display in the admin dashboard.
 *
 * Requires: SENTRY_AUTH_TOKEN and SENTRY_ORG_SLUG env vars
 * in addition to SENTRY_DSN.
 */

import { logger } from './logger.js';

const log = logger.child({ module: 'sentry-errors' });

interface SentryError {
  title: string;
  culprit: string;
  level: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  platform: string;
  metadata: Record<string, unknown>;
}

interface SentryErrorsResponse {
  errors: SentryError[];
  timestamp: string;
}

/**
 * Fetch recent errors from the Sentry API.
 * Uses the Sentry Discover/Issues endpoint.
 */
export async function fetchRecentSentryErrors(options?: {
  project?: string;
  environment?: string;
  query?: string;
  limit?: number;
}): Promise<SentryErrorsResponse> {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const orgSlug = process.env.SENTRY_ORG_SLUG;

  if (!authToken || !orgSlug) {
    log.warn('[Sentry] SENTRY_AUTH_TOKEN or SENTRY_ORG_SLUG not set — error fetching disabled');
    return { errors: [], timestamp: new Date().toISOString() };
  }

  const limit = options?.limit ?? 25;
  const baseUrl = process.env.SENTRY_HOST || 'https://sentry.io';

  // Build query string for the Sentry Issues API
  const params = new URLSearchParams();
  if (options?.project) params.set('project', options.project);
  if (options?.environment) params.set('environment', options.environment);
  params.set('query', options?.query || 'is:unresolved');
  params.set('sort', 'date');
  params.set('statsPeriod', '24h');

  const url = `${baseUrl}/api/0/organizations/${orgSlug}/issues/?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    if (!response.ok) {
      const body = await response.text();
      log.error({ status: response.status, body }, '[Sentry] Failed to fetch errors');
      return { errors: [], timestamp: new Date().toISOString() };
    }

    const data = (await response.json()) as any[];

    const errors: SentryError[] = (data || []).slice(0, limit).map((issue: any) => ({
      title: issue.title || 'Unknown Error',
      culprit: issue.culprit || '',
      level: issue.level || 'error',
      count: issue.count || 0,
      firstSeen: issue.firstSeen || '',
      lastSeen: issue.lastSeen || '',
      platform: issue.platform || '',
      metadata: issue.metadata || {},
    }));

    return {
      errors,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, '[Sentry] Error fetching recent errors');
    return { errors: [], timestamp: new Date().toISOString() };
  }
}
