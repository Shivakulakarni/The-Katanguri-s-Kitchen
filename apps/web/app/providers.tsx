'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, trackPageView } from './lib/analytics';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (pathname && pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname]);

  return <>{children}</>;
}
