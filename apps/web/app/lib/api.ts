// Use Next.js proxy (see next.config.js rewrites) in browser, direct URL for SSR
const API_BASE = typeof window === 'undefined'
  ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  : '';

import {
  AppError,
  ensureAppError,
  parseApiError,
  reportError,
  withRetry,
  type RetryOptions,
} from './errors';

interface ApiOptions extends RequestInit {
  token?: string;
  timeout?: number;
  retry?: boolean | RetryOptions;
}

const DEFAULT_TIMEOUT = 15_000;

function generateRequestId(): string {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'web-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * FAANG-grade API request function with:
 * - Typed errors (AppError hierarchy)
 * - Automatic retry with exponential backoff for transient failures
 * - Request timeout with AbortController
 * - Structured error reporting
 */
async function request<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, timeout = DEFAULT_TIMEOUT, retry, ...fetchOpts } = opts;
  const requestId = (fetchOpts.headers as Record<string, string>)?.[ 'X-Request-Id'] || generateRequestId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...((fetchOpts.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const doFetch = async (): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...fetchOpts,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 401 && !path.includes('/auth/') && token) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // New controller + timeout for the retry
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);
          try {
            const retryRes = await fetch(`${API_BASE}${path}`, {
              ...fetchOpts,
              headers,
              credentials: 'include',
              signal: retryController.signal,
            });
            clearTimeout(retryTimeoutId);
            if (!retryRes.ok) {
              const error = await parseApiError(retryRes);
              throw error;
            }
            return retryRes.json();
          } catch (retryErr) {
            clearTimeout(retryTimeoutId);
            throw retryErr;
          }
        }
      }

      if (!res.ok) {
        const error = await parseApiError(res);
        reportError(error, { path, method: fetchOpts.method || 'GET' });
        throw error;
      }

      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);

      // AbortError = timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        const timeoutError = new AppError({
          message: `Request timed out after ${timeout / 1000}s`,
          statusCode: 408,
          category: 'network',
          isRetryable: true,
          context: { path, method: fetchOpts.method || 'GET', timeout },
        });
        reportError(timeoutError);
        throw timeoutError;
      }

      throw ensureAppError(err);
    }
  };

  // If retry is enabled, wrap in retry logic
  if (retry) {
    const retryOpts: RetryOptions = typeof retry === 'object' ? retry : {
      maxRetries: 2,
      baseDelay: 1000,
      onRetry: (attempt, error) => {
        if (typeof window !== 'undefined') {
          console.warn(`[API] Retry ${attempt} for ${path}: ${error.message}`);
        }
      },
    };
    return withRetry(doFetch, retryOpts);
  }

  return doFetch();
}

export const api = {
  get: <T = any>(path: string, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'GET', token, retry: true, ...opts }),
  post: <T = any>(path: string, body?: any, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      token,
      retry: false, // Don't retry mutations by default
      ...opts,
    }),
  patch: <T = any>(path: string, body?: any, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      token,
      retry: false,
      ...opts,
    }),
  delete: <T = any>(path: string, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, {
      method: 'DELETE',
      token,
      retry: false,
      ...opts,
    }),
};

/**
 * React Query helper: wraps api.get with auth token from the store.
 * Use inside components that have QueryProvider in the tree.
 */
export function createAuthenticatedQuery<T = any>(
  path: string,
  token: string | null,
  opts?: { staleTime?: number; enabled?: boolean }
) {
  return {
    queryKey: ['api', path, token],
    queryFn: () => request<T>(path, { method: 'GET', token: token || undefined, retry: true }),
    staleTime: opts?.staleTime ?? 30_000,
    enabled: opts?.enabled ?? true,
  };
}

export const API_BASE_URL = API_BASE;
