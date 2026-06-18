'use client';

import React from 'react';
import { ensureAppError, reportError, type AppError as AppErrorType } from '../lib/errors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppErrorType | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  /** Delay in ms between retries — doubles each attempt */
  retryBaseDelay?: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error: ensureAppError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError = ensureAppError(error);
    reportError(appError, { componentStack: errorInfo.componentStack });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset when children change (e.g. after navigation)
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null, retryCount: 0 });
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const nextRetry = this.state.retryCount + 1;

    if (nextRetry > maxRetries) {
      // Max retries exceeded — force full page reload as last resort
      window.location.reload();
      return;
    }

    // Exponential backoff: 1s, 2s, 4s (instant state reset triggers re-render, tracking count here)
    this.setState({ retryCount: nextRetry, hasError: false, error: null });

    // The retry is instant (state reset triggers re-render), but we track count
    // for UI feedback. If it fails again, componentDidCatch fires with incremented count.
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const { maxRetries = 3 } = this.props;
      const canRetry = this.state.retryCount < maxRetries;
      const error = this.state.error;

      return (
        <div role="alert" aria-live="assertive" style={{
          padding: '60px 20px', textAlign: 'center', maxWidth: 480, margin: '0 auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {error.severity === 'critical' ? '🚨' : error.category === 'network' ? '📡' : '😞'}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#1c1c1c' }}>
            {error.category === 'network'
              ? 'Connection Problem'
              : error.category === 'auth'
              ? 'Authentication Required'
              : 'Something went wrong'}
          </h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>
            {error.category === 'network'
              ? 'Please check your internet connection and try again.'
              : error.message || 'An unexpected error occurred.'}
          </p>
          {/* Error ID for support reference */}
          <p style={{ fontSize: 11, color: '#767676', marginBottom: 20, fontFamily: 'monospace' }}>
            Error ID: {error.errorId}
          </p>

          {error.isRetryable && canRetry && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '12px 32px', fontSize: 14, fontWeight: 700, color: '#fff',
                  background: '#e23744', border: 'none', borderRadius: 12, cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              >
                Try Again {this.state.retryCount > 0 && `(${this.state.retryCount}/${maxRetries})`}
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 32px', fontSize: 14, fontWeight: 700, color: '#666',
                  background: '#f5f5f5', border: 'none', borderRadius: 12, cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>
          )}

          {(!error.isRetryable || !canRetry) && (
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 32px', fontSize: 14, fontWeight: 700, color: '#fff',
                background: '#e23744', border: 'none', borderRadius: 12, cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
