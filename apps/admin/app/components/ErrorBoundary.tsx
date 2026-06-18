'use client';

import React from 'react';
import { Card, Btn, T } from '../ui';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  pageName?: string;
  maxRetries?: number;
}

/** Generate a unique error ID for support tracking */
function generateErrorId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `admin_${ts}_${rand}`;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null, retryCount: 0, errorId: null });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary] ${this.props.pageName || 'Page'} error:`, {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries ?? 3;
    if (this.state.retryCount >= maxRetries) {
      window.location.reload();
      return;
    }
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      errorId: null,
    }));
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = this.props.maxRetries ?? 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div style={{ padding: '4px 0' }}>
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <AlertTriangle size={48} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: T.ink }}>
              Something went wrong
            </h3>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 8 }}>
              {this.props.pageName ? `The ${this.props.pageName} page` : 'This page'} encountered an unexpected error.
            </p>
            {/* Error ID for support reference */}
            {this.state.errorId && (
              <p style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginBottom: 8 }}>
                Error ID: {this.state.errorId}
              </p>
            )}
            {this.state.error && (
              <div style={{
                background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
                padding: '12px 16px', marginBottom: 20, textAlign: 'left',
                fontFamily: 'monospace', fontSize: 12, color: '#991b1b',
                maxWidth: 600, margin: '0 auto 20px', overflow: 'auto',
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {canRetry ? (
                <Btn variant="primary" onClick={this.handleRetry}>
                  Try Again {this.state.retryCount > 0 && `(${this.state.retryCount}/${maxRetries})`}
                </Btn>
              ) : (
                <Btn variant="primary" onClick={() => window.location.reload()}>
                  Reload Page
                </Btn>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
