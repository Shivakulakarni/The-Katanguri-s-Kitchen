'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './auth-store';

export default function NavAuth() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} suppressHydrationWarning />
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/auth?mode=login" className="filter-chip" style={{ fontSize: 14, padding: '8px 16px' }}>Log In</Link>
        <Link href="/auth?mode=signup" className="btn btn-primary" style={{ fontSize: 14, padding: '10px 24px' }}>Sign Up</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Link href="/account" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }}>
        👤 {user.name || user.email || 'Account'}
      </Link>
      <button
        onClick={() => { logout(); router.push('/'); }}
        style={{
          fontSize: 13, fontWeight: 600, color: 'var(--steel)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
        }}
      >
        Logout
      </button>
    </div>
  );
}
