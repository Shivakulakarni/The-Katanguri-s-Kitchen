'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function PromoBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('promo-banner-dismissed');
    if (dismissed) setVisible(false);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('promo-banner-dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div className="promo-banner" style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
      position: 'relative',
    }}>
      <Image src="/logo.avif" alt="Logo" width={20} height={20} style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
      <span>🔥 Cooked with love, packed with care — Free delivery on orders above ₹500</span>
      <a href="/menu" style={{ color: 'var(--primary-soft)', textDecoration: 'underline', marginLeft: 4, fontWeight: 700, transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#ffffff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--primary-soft)'}>Order now</a>
      <button onClick={dismiss} aria-label="Close promo banner" style={{
        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', color: 'var(--stone)', cursor: 'pointer',
        fontSize: 16, padding: 4, lineHeight: 1, fontWeight: 700, borderRadius: 'var(--rounded-circle)',
        minWidth: 44, minHeight: 44, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
      }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--stone)'; }}>✕</button>
    </div>
  );
}
