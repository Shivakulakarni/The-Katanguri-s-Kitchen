'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ fontSize: 16, color: 'var(--steel)', marginBottom: 24, maxWidth: 400 }}>
          {error.digest ? `Error ${error.digest}` : 'An unexpected error occurred. Please try again.'}
        </p>
        <button onClick={reset} className="btn btn-primary">Try Again</button>
      </div>
    </div>
  );
}
