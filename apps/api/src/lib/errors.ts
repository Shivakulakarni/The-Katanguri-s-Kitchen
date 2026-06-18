/**
 * Standardized error response format.
 * All API endpoints should return errors in this shape.
 */
export interface ApiErrorResponse {
  error: string;
  statusCode: number;
  message?: string;
  details?: string | Array<{ field: string; message: string }>;
}

/**
 * Application-level error class for consistent error handling.
 * Thrown errors are caught by the global error handler in index.ts.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: string | Array<{ field: string; message: string }>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: { details?: string | Array<{ field: string; message: string }>; isOperational?: boolean }
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;
  }
}

// Common error factories
export const Errors = {
  badRequest: (message: string, details?: string) =>
    new AppError(message, 400, { details }),

  unauthorized: (message = 'Authentication required') =>
    new AppError(message, 401),

  forbidden: (message = 'Access denied') =>
    new AppError(message, 403),

  notFound: (message = 'Resource not found') =>
    new AppError(message, 404),

  conflict: (message: string) =>
    new AppError(message, 409),

  tooMany: (message = 'Too many requests. Please try again later.') =>
    new AppError(message, 429),

  internal: (message = 'Internal server error', details?: string) =>
    new AppError(message, 500, { details, isOperational: false }),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new AppError(message, 503),
} as const;
