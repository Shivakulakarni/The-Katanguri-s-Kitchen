'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 64, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: 18, color: 'var(--steel)', marginBottom: 24 }}>This page could not be found.</p>
        <Link href="/" className="btn btn-primary">Go Home</Link>
      </div>
    </div>
  );
}
