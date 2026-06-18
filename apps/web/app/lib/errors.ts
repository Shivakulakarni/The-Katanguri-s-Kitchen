/**
 * FAANG-grade error handling utilities.
 *
 * Provides:
 * - Typed error classes with error IDs for tracking
 * - Retry logic with exponential backoff and jitter
 * - Error classification (transient vs permanent)
 * - Structured error reporting
 */

// ── Error Classification ──

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'client' | 'unknown';

// ── Typed Error Classes ──

export class AppError extends Error {
  public readonly errorId: string;
  public readonly statusCode: number;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly isRetryable: boolean;
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(options: {
    message: string;
    statusCode?: number;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    isRetryable?: boolean;
    context?: Record<string, unknown>;
    cause?: Error;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.errorId = generateErrorId();
    this.statusCode = options.statusCode ?? 500;
    this.category = options.category ?? classifyError(options.statusCode ?? 500);
    this.severity = options.severity ?? inferSeverity(options.statusCode ?? 500);
    this.isRetryable = options.isRetryable ?? isRetryableStatus(options.statusCode ?? 500);
    this.timestamp = Date.now();
    this.context = options.context;
    this.cause = options.cause;
  }

  toJSON() {
    return {
      errorId: this.errorId,
      message: this.message,
      statusCode: this.statusCode,
      category: this.category,
      severity: this.severity,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error — please check your connection', options?: { cause?: Error }) {
    super({ message, statusCode: 0, category: 'network', isRetryable: true, cause: options?.cause });
    this.name = 'NetworkError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required', options?: { statusCode?: number; cause?: Error }) {
    super({ message, statusCode: options?.statusCode ?? 401, category: 'auth', isRetryable: false });
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  public readonly fields: Array<{ field: string; message: string }>;

  constructor(
    message = 'Validation failed',
    fields: Array<{ field: string; message: string }> = [],
    options?: { cause?: Error }
  ) {
    super({ message, statusCode: 400, category: 'validation', isRetryable: false, cause: options?.cause });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter = 60, options?: { cause?: Error }) {
    super({
      message: `Too many requests. Please try again in ${retryAfter}s.`,
      statusCode: 429,
      category: 'server',
      isRetryable: true,
      cause: options?.cause,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ── Error ID Generation ──

let errorCounter = 0;

function generateErrorId(): string {
  errorCounter++;
  const timestamp = Date.now().toString(36);
  const counter = errorCounter.toString(36).padStart(4, '0');
  const random = Math.random().toString(36).slice(2, 6);
  return `err_${timestamp}_${counter}_${random}`;
}

// ── Classification Helpers ──

function classifyError(statusCode: number): ErrorCategory {
  if (statusCode === 0) return 'network';
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode >= 400 && statusCode < 500) return 'validation';
  if (statusCode >= 500) return 'server';
  return 'unknown';
}

function inferSeverity(statusCode: number): ErrorSeverity {
  if (statusCode >= 500) return 'high';
  if (statusCode === 401 || statusCode === 403) return 'medium';
  if (statusCode === 429) return 'medium';
  if (statusCode >= 400) return 'low';
  return 'low';
}

function isRetryableStatus(statusCode: number): boolean {
  // Network errors (0), timeouts (408), rate limits (429), server errors (502-504)
  return statusCode === 0 || statusCode === 408 || statusCode === 429 ||
    (statusCode >= 502 && statusCode <= 504);
}

// ── Retry with Exponential Backoff + Jitter ──

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: AppError) => void;
  retryOn?: (error: AppError) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry,
    retryOn,
  } = options;

  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const appError = ensureAppError(err);
      lastError = appError;

      // Check if we should retry
      const shouldRetry =
        attempt < maxRetries &&
        appError.isRetryable &&
        (retryOn ? retryOn(appError) : true);

      if (!shouldRetry) throw appError;

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = exponentialDelay * 0.2 * Math.random();
      const delay = exponentialDelay + jitter;

      onRetry?.(attempt + 1, appError);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new AppError({ message: 'Max retries exceeded' });
}

// ── Parse API Error Response ──

export async function parseApiError(response: Response): Promise<AppError> {
  let body: any;

  try {
    body = await response.json();
  } catch {
    body = {};
  }

  const message = body.error || body.message || `Request failed: ${response.status}`;
  const details = body.details;

  if (response.status === 401) {
    return new AuthError(message, { statusCode: 401 });
  }

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    return new RateLimitError(retryAfter);
  }

  if (response.status >= 400 && response.status < 500 && details) {
    return new ValidationError(message, Array.isArray(details) ? details : [], {
      cause: new Error(JSON.stringify(details)),
    });
  }

  return new AppError({
    message,
    statusCode: response.status,
    context: { details, url: response.url },
  });
}

// ── Convert any error to AppError ──

export function ensureAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    // Detect network errors
    if (
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('Network request failed') ||
      err.message.includes('Load failed')
    ) {
      return new NetworkError(err.message, { cause: err });
    }
    return new AppError({
      message: err.message,
      cause: err,
      category: 'unknown',
    });
  }
  return new AppError({
    message: String(err),
    category: 'unknown',
  });
}

// ── Error Reporting (console in dev, can be swapped for Sentry in prod) ──

export function reportError(error: AppError, extras?: Record<string, unknown>) {
  // 401/403 are expected auth flows (expired session, access denied) — not reportable bugs
  if (error.statusCode === 401 || error.statusCode === 403) return;

  const report = {
    ...error.toJSON(),
    ...extras,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorReport]', report);
  } else {
    // In production, send to Sentry
    if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
      try {
        (window as any).__SENTRY__.captureException(error, {
          extra: report,
          tags: { category: error.category, severity: error.severity },
        });
      } catch {
        // Sentry not available — fallback to console
      }
    }
    console.error('[ErrorReport]', report);
  }
}

