'use client';

/**
 * Global error monitoring for the web app.
 * Catches unhandled errors and promise rejections that escape React error boundaries.
 *
 * Placed at the top level so it initializes once on app load.
 */

import { ensureAppError, reportError } from './errors';

// Prevent double-initialization
let initialized = false;

export function initErrorMonitoring() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // ── Global error handler — catches errors not caught by React boundaries ──
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message || 'Unknown error');
    const appError = ensureAppError(error);

    reportError(appError, {
      source: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // ── Unhandled promise rejection — the #1 source of silent bugs ──
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const appError = ensureAppError(error);

    reportError(appError, {
      source: 'unhandledrejection',
      // In production, you could also call event.preventDefault() to suppress
      // the console error, but we let it through for visibility.
    });
  });

  // ── React hydration mismatch detection (dev only) ──
  if (process.env.NODE_ENV === 'development') {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0]?.toString?.() || '';
      if (message.includes('Hydration') || message.includes('hydrat')) {
        console.warn('[ErrorMonitoring] Hydration mismatch detected:', message);
      }
      originalConsoleError.apply(console, args);
    };
  }
}

// Auto-initialize on import
initErrorMonitoring();
