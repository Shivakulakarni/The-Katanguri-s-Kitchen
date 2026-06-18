import type { Metadata } from 'next';

const SITE_URL = process.env.SITE_URL || 'https://thekatanguriskitchen.com';
import { AdminAuthProvider } from './auth-provider';
import AdminShell from './AdminShell';
import { AdminToastProvider } from './AdminToastProvider';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import './admin.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  display: 'swap',
  variable: '--font-outfit',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

// Disable static prerendering — admin layout relies on client-side auth state
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "The Katanguri's Kitchen — Admin",
  description: 'Admin dashboard for managing orders, menu, inventory, and deliveries.',
  icons: { icon: '/admin/favicon.png' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${plusJakarta.variable}`}>
      <body style={{ fontFamily: 'var(--font-plus-jakarta), -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <AdminAuthProvider>
          <AdminToastProvider>
            <AdminShell>{children}</AdminShell>
          </AdminToastProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
