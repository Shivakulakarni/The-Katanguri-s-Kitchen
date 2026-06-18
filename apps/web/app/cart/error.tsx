'use client';

export default function CartError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#666', marginBottom: 16 }}>{error.message || 'Please try again.'}</p>
        <button onClick={reset} className="btn btn-primary">Try Again</button>
      </div>
    </div>
  );
}
