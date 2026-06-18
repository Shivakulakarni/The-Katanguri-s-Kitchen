'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

export function GoogleAnalytics() {
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('cookie-consent');
    setConsent(stored === 'accepted');
  }, []);

  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId || !consent) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
