import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  RateLimitError,
  ensureAppError,
  withRetry,
} from '../errors';

// ── AppError ──

describe('AppError', () => {
  it('creates an error with default values', () => {
    const err = new AppError({ message: 'test' });
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('AppError');
    expect(err.errorId).toMatch(/^err_/);
    expect(err.category).toBe('server');
    expect(err.severity).toBe('high');
    expect(err.isRetryable).toBe(false);
    expect(err.timestamp).toBeGreaterThan(0);
  });

  it('creates an error with custom values', () => {
    const err = new AppError({
      message: 'not found',
      statusCode: 404,
      category: 'validation',
      severity: 'low',
      isRetryable: false,
      context: { path: '/api/test' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.category).toBe('validation');
    expect(err.severity).toBe('low');
    expect(err.isRetryable).toBe(false);
    expect(err.context).toEqual({ path: '/api/test' });
  });

  it('serializes to JSON correctly', () => {
    const err = new AppError({ message: 'test', statusCode: 400 });
    const json = err.toJSON();
    expect(json).toHaveProperty('errorId');
    expect(json.message).toBe('test');
    expect(json.statusCode).toBe(400);
  });

  it('generates unique error IDs', () => {
    const err1 = new AppError({ message: 'a' });
    const err2 = new AppError({ message: 'b' });
    expect(err1.errorId).not.toBe(err2.errorId);
  });
});

// ── Error subclasses ──

describe('NetworkError', () => {
  it('has network category and is retryable', () => {
    const err = new NetworkError();
    expect(err.category).toBe('network');
    expect(err.isRetryable).toBe(true);
    expect(err.statusCode).toBe(0);
  });
});

describe('AuthError', () => {
  it('has auth category and is not retryable', () => {
    const err = new AuthError();
    expect(err.category).toBe('auth');
    expect(err.isRetryable).toBe(false);
    expect(err.statusCode).toBe(401);
  });
});

describe('ValidationError', () => {
  it('includes field-level errors', () => {
    const err = new ValidationError('Validation failed', [
      { field: 'email', message: 'Invalid email' },
    ]);
    expect(err.fields).toHaveLength(1);
    expect(err.fields[0].field).toBe('email');
    expect(err.category).toBe('validation');
    expect(err.isRetryable).toBe(false);
  });
});

describe('RateLimitError', () => {
  it('has retry-after and is retryable', () => {
    const err = new RateLimitError(30);
    expect(err.retryAfter).toBe(30);
    expect(err.isRetryable).toBe(true);
    expect(err.statusCode).toBe(429);
  });
});

// ── ensureAppError ──

describe('ensureAppError', () => {
  it('returns AppError as-is', () => {
    const err = new AppError({ message: 'test' });
    expect(ensureAppError(err)).toBe(err);
  });

  it('wraps plain Error', () => {
    const err = ensureAppError(new Error('plain error'));
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('plain error');
  });

  it('detects network errors by message', () => {
    const err = ensureAppError(new Error('Failed to fetch'));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.isRetryable).toBe(true);
  });

  it('wraps non-Error values', () => {
    const err = ensureAppError('string error');
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('string error');
  });
});

// ── withRetry ──

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on first try without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxRetries: 2, baseDelay: 100 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new AppError({ message: 'fail', statusCode: 502, isRetryable: true }))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100 });
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new AppError({ message: 'fail', statusCode: 400, isRetryable: false }));

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 100 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new AppError({ message: 'fail', isRetryable: true }))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100, onRetry });
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(AppError));
  });
});
