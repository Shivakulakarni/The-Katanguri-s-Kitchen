/**
 * Sentry Error Monitoring — initializes Sentry for production error tracking.
 *
 * Environment variables:
 *   SENTRY_DSN          — Your Sentry project DSN
 *   SENTRY_ENVIRONMENT  — Environment name (defaults to NODE_ENV)
 *   SENTRY_RELEASE      — Release version (optional)
 *   SENTRY_TRACES_SAMPLE_RATE — Performance monitoring sample rate (0-1, default 0.1)
 */

import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger.js';

let initialized = false;

export function initSentry() {
  if (initialized) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn('[Sentry] SENTRY_DSN not set — error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || 'kitchen-api@1.0.0',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Don't report operational errors (bad requests, auth failures, etc.)
    beforeSend(event, hint) {
      const error = hint?.originalException;

      // Skip operational errors — these are expected business errors
      if (error && typeof error === 'object' && 'isOperational' in error) {
        if ((error as any).isOperational === true) return null;
      }

      // Skip health check noise
      const url = event.request?.url || '';
      if (url.includes('/health') || url.includes('/metrics')) return null;

      // Skip Redis version warnings
      const errObj = error as any;
      const message = (errObj?.message || event.exception?.values?.[0]?.value || '') as string;
      if (message.includes('Redis version')) return null;

      return event;
    },

    // Scrub sensitive data from error reports
    beforeSendTransaction(transaction) {
      if (transaction.request?.headers) {
        delete transaction.request.headers.authorization;
        delete transaction.request.headers.cookie;
      }
      return transaction;
    },
  });

  initialized = true;
  logger.info('[Sentry] Error monitoring initialized');
}

/** Capture an exception manually */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/** Capture a message/info event */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

/** Flush pending events before shutdown */
export async function flushSentry(timeout = 2000) {
  if (!initialized) return;
  await Sentry.close(timeout);
}
