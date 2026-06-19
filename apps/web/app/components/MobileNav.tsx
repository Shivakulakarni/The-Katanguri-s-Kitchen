'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, UtensilsCrossed, ShoppingCart, Package, MapPin } from 'lucide-react';
import ThemeToggle from '../lib/theme-toggle';
import { useCartStore } from '../lib/cart-store';

const items = [
  { href: '/',       label: 'Home',    icon: <Home size={20} /> },
  { href: '/menu',   label: 'Menu',    icon: <UtensilsCrossed size={20} /> },
  { href: '/cart',   label: 'Cart',    icon: <ShoppingCart size={20} />, showBadge: true },
  { href: '/orders', label: 'Orders',  icon: <Package size={20} /> },
  { href: '/track',  label: 'Track',   icon: <MapPin size={20} /> },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const cartCount = useCartStore(s => s.getCount());

  useEffect(() => { setMounted(true); }, []);

  return (
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--canvas)', borderTop: '1px solid var(--hairline-soft)',
      display: 'flex', justifyContent: 'space-around', padding: '4px 0 8px',
      zIndex: 100,
    }}>
      {items.map(item => {
        const isActive = item.href === '/' ? pathname === item.href : (pathname?.startsWith(item.href) ?? false);
        return (
          <Link key={item.href} href={item.href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, fontSize: 10, color: isActive ? 'var(--primary)' : 'var(--stone)', fontWeight: 700,
              textDecoration: 'none', minWidth: 48, minHeight: 44, padding: '4px 8px',
              position: 'relative',
            }}>
            <span style={{ position: 'relative' }}>
              {item.icon}
              {item.showBadge && mounted && cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -8,
                  background: 'var(--primary)', color: '#fff',
                  fontSize: 9, fontWeight: 800, borderRadius: '50%',
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            {item.label}
          </Link>
        );
      })}
      <ThemeToggle mobile />
    </nav>
  );
}
