'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminAuthStore } from '../lib/auth-store';
import { initAnalytics, trackPageView } from './lib/analytics';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const loadFromStorage = useAdminAuthStore(s => s.loadFromStorage);
  const pathname = usePathname();

  useEffect(() => {
    loadFromStorage();
    initAnalytics();
  }, [loadFromStorage]);

  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);

  return <>{children}</>;
}
