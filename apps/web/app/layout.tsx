import './globals.css';
import './lib/error-monitor';
import { AuthProvider } from './lib/auth-provider';
import { Providers } from './providers';
import PromoBanner from './lib/promo-banner';
import ThemeToggle from './lib/theme-toggle';
import Logo from './lib/logo';
import Link from 'next/link';
import NavAuth from './lib/nav-auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GoogleAnalytics } from './components/GoogleAnalytics';
import { ToastContainer } from './components/Toast';
import dynamicImport from 'next/dynamic';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import MobileNav from './components/MobileNav';
import { Suspense } from 'react';
import CookieConsent from './components/CookieConsent';
import CartBadge from './components/CartBadge';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

const AIChatbot = dynamicImport(() => import('./components/AIChatbot'), { ssr: false });

export const viewport = { themeColor: '#e63946', width: 'device-width', initialScale: 1 };

const SITE_URL = process.env.SITE_URL || 'https://thekatanguriskitchen.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Katanguri's Kitchen — Authentic South Indian Cloud Kitchen in Warangal",
    template: "%s | The Katanguri's Kitchen",
  },
  description: 'Cooked with love, packed with care, and delivered fresh. Authentic South Indian flavors — Dum Biryani, Starters, Curries from Hanamkonda, Warangal. Order online now!',
  keywords: ['cloud kitchen', 'south indian food', 'biryani', 'warangal', 'hanamkonda', 'food delivery', 'dum biryani', 'starters', 'curries', 'the katanguri kitchen'],
  authors: [{ name: "The Katanguri's Kitchen" }],
  creator: "The Katanguri's Kitchen",
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://thekatanguriskitchen.com',
    siteName: "The Katanguri's Kitchen",
    title: "The Katanguri's Kitchen — Authentic South Indian Cloud Kitchen",
    description: 'Cooked with love, packed with care, and delivered fresh. Authentic South Indian flavors from Hanamkonda, Warangal.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: "The Katanguri's Kitchen — Delicious South Indian Food",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "The Katanguri's Kitchen — Authentic South Indian Cloud Kitchen",
    description: 'Cooked with love, packed with care, and delivered fresh.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  manifest: '/manifest.json',
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  "name": "The Katanguri's Kitchen",
  "servesCuisine": "Indian",
  "address": { "@type": "PostalAddress", "addressLocality": "Warangal", "addressRegion": "Telangana" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "250" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <noscript suppressHydrationWarning>Please enable JavaScript to use The Katanguri&apos;s Kitchen</noscript>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <Providers>
        <AuthProvider>
        {/* Promo Banner (Meta style — closeable, persisted) */}
        <PromoBanner />

        {/* Desktop Nav */}
        <nav aria-label="Main navigation" className="desktop-only" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 32px', height: 64, borderBottom: '1px solid var(--hairline-soft)',
          background: 'var(--canvas)', position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', letterSpacing: '-0.5px', textDecoration: 'none' }}>
              <Logo size={24} /> The Katanguri's Kitchen
            </Link>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Menu',      href: '/menu' },
                { label: 'Meal Planner', href: '/meal-planner' },
                { label: 'Cart',      href: '/cart', badge: true },
                { label: 'My Orders', href: '/orders' },
                { label: 'Track',     href: '/track' },
                { label: 'Contact',   href: '/contact' },
              ].map(tab => (
                <Link key={tab.label} href={tab.href}
                  className="filter-chip" style={{ fontSize: 14, padding: '8px 16px', display: 'inline-flex', alignItems: 'center' }}>
                  {tab.label}
                  {tab.badge && <CartBadge />}
                </Link>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <ThemeToggle />
            <NavAuth />
          </div>
        </nav>

        <MobileNav />

        {/* Global Toast Notifications */}
        <ToastContainer />

        {/* Global AI Support Assistant */}
        <Suspense fallback={null}><AIChatbot /></Suspense>

        <main id="main-content" style={{ paddingBottom: 80, minHeight: 'calc(100vh - 64px)' }}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>

        {/* Footer - Desktop */}
        <footer className="desktop-only" aria-label="Footer" style={{
          background: 'var(--canvas)', color: 'var(--steel)',
          padding: 'var(--space-section) var(--space-xxl) var(--space-xl)',
          borderTop: '1px solid var(--hairline-soft)',
        }}>
          <div className="container footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 16, letterSpacing: '-0.5px' }}>
                <Logo size={20} /> The Katanguri's Kitchen
              </div>
              <p style={{ color: 'var(--steel)', fontSize: 14, lineHeight: 1.5, maxWidth: 300 }}>
                Cooked with love, packed with care, and delivered fresh.
                Authentic South Indian flavors from Hanamkonda, Warangal.
              </p>
            </div>
            {[
              { title: 'Quick Links', links: [
                { label: 'Menu', href: '/menu' },
                { label: 'Cart', href: '/cart' },
                { label: 'Track Order', href: '/track' },
                { label: 'My Account', href: '/account' },
              ]},
              { title: 'Support', links: [
                { label: 'Help Center', href: '/faq' },
                { label: 'Contact Us', href: 'mailto:hello@thekatanguriskitchen.com' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms', href: '/terms' },
              ]},
              { title: 'Contact', links: [
                { label: 'hello@thekatanguriskitchen.com', href: 'mailto:hello@thekatanguriskitchen.com' },
                { label: '+91 93479 68582', href: 'tel:+919347968582' },
                { label: 'Hanamkonda, Warangal', href: '#' },
              ]},
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--ink)', letterSpacing: '-0.14px' }}>{col.title}</h4>
                {col.links.map(link => {
                  const isExternal = link.href.startsWith('mailto:') || link.href.startsWith('tel:');
                  if (isExternal) {
                    return <a key={link.label} href={link.href}
                      style={{ display: 'block', fontSize: 14, color: 'var(--steel)', marginBottom: 10, lineHeight: 1.43 }}>
                      {link.label}
                    </a>;
                  }
                  return <Link key={link.label} href={link.href}
                    style={{ display: 'block', fontSize: 14, color: 'var(--steel)', marginBottom: 10, lineHeight: 1.43 }}>
                    {link.label}
                  </Link>;
                })}
              </div>
            ))}
          </div>
          <div className="container" style={{
            marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--hairline-soft)',
            textAlign: 'center', fontSize: 12, color: 'var(--stone)'
          }}>
            © 2026 The Katanguri's Kitchen. All rights reserved.
            <br />
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--stone)', textDecoration: 'underline' }}>Photos provided by Pexels</a>
          </div>
        </footer>

        {/* Footer - Mobile */}
        <footer className="footer-mobile mobile-only" aria-label="Footer" style={{
          display: 'none', background: 'var(--canvas)', color: 'var(--steel)',
          padding: '32px 20px 24px', borderTop: '1px solid var(--hairline-soft)',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>
              The Katanguri&apos;s Kitchen
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              Cooked with love, packed with care, delivered fresh from Hanamkonda, Warangal.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quick Links</h4>
              {['Menu', 'Cart', 'Track Order', 'My Account'].map(label => {
                const href = label === 'My Account' ? '/account' : label === 'Track Order' ? '/track' : `/${label.toLowerCase()}`;
                return <Link key={label} href={href} style={{ display: 'block', fontSize: 13, color: 'var(--steel)', marginBottom: 6 }}>{label}</Link>;
              })}
            </div>
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</h4>
              <a href="tel:+919347968582" style={{ display: 'block', fontSize: 13, color: 'var(--steel)', marginBottom: 6 }}>+91 93479 68582</a>
              <a href="mailto:hello@thekatanguriskitchen.com" style={{ display: 'block', fontSize: 13, color: 'var(--steel)', marginBottom: 6 }}>hello@thekatanguriskitchen.com</a>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--steel)', marginBottom: 6 }}>Hanamkonda, Warangal</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--steel)', marginBottom: 6 }}>12 PM - 10 PM, All Days</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--stone)' }}>
            © 2026 The Katanguri&apos;s Kitchen. All rights reserved.
            <br />
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--stone)', textDecoration: 'underline' }}>Photos provided by Pexels</a>
          </div>
        </footer>
        </AuthProvider>
        </Providers>
        <CookieConsent />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
