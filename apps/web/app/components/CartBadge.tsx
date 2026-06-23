'use client';

import { useCartStore } from '../lib/cart-store';

export default function CartBadge() {
  const items = useCartStore((s: any) => s.items);
  const count = items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

  if (count === 0) return null;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      background: 'var(--primary)', color: '#fff',
      borderRadius: 9, fontSize: 11, fontWeight: 700,
      lineHeight: 1, marginLeft: 4,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
