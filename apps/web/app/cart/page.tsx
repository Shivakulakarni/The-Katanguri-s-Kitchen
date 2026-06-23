'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCartStore } from '../lib/cart-store';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

export default function CartPage() {
  const { items, updateQuantity, removeItem, getTotal, getItemTotal, validateCart } = useCartStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  // Validate cart on load
  useEffect(() => {
    if (items.length === 0) return;
    validateCart().then(({ removed }) => {
      if (removed > 0) {
        import('../lib/toast-store').then(({ toast }) => {
          toast.warning('Some items removed', `${removed} item(s) no longer available and were removed from your cart`);
        });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!hydrated) return <div className="container" style={{ paddingTop: 32, textAlign: 'center', color: '#767676' }}>Loading cart...</div>;
  const subtotal = getTotal();
  const deliveryFee = subtotal >= 500 ? 0 : 40;
  const total = subtotal + deliveryFee;

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 style={{ fontSize: 36, fontWeight: 500, marginBottom: 32, letterSpacing: '-0.5px' }}>Your Cart</h1>

      <div className="cart-layout" style={{ display: 'grid', gap: 32, alignItems: 'start' }}>
        <style>{`.cart-layout{grid-template-columns:1fr}@media(min-width:769px){.cart-layout{grid-template-columns:1fr 380px}}`}</style>
        {/* Left: Items */}
        <div>
          {items.length === 0 ? (
            <div className="card" style={{ padding: 'var(--space-xxl)', textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
              <h3 style={{ fontSize: 24, fontWeight: 500, marginBottom: 8, color: 'var(--ink-deep)' }}>Your cart is empty</h3>
              <p style={{ color: 'var(--steel)', marginBottom: 24, fontSize: 16 }}>Looks like you haven't added anything yet</p>
              <Link href="/menu" className="btn btn-primary">Browse Menu</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item, i) => (
                <div key={item.id} className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12, flexWrap: 'wrap',
                  animation: `fadeInUp 0.3s ease ${i * 0.04}s forwards`, opacity: 0,
                }}>
                  <div style={{ width: 64, height: 64, borderRadius: 'var(--rounded-xl)', background: 'var(--surface-soft)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }}
                      />
                    ) : null}
                    <span hidden={!item.image} style={{ fontSize: 28 }}>🍽️</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className={`tag ${item.veg ? 'tag-veg' : 'tag-nonveg'}`} style={{ fontSize: 9, padding: '2px 6px' }}>
                        {item.veg ? 'VEG' : 'NON-VEG'}
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)' }}>{item.name}</h3>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)' }}>{formatPrice(item.price)}</div>
                  </div>
                  <div className="stepper">
                    <button role="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease ${item.name} quantity`} style={{ opacity: item.quantity <= 1 ? 0.4 : 1, cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer' }}>−</button>
                    <span className="qty">{item.quantity}</span>
                    <button role="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`}>+</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                      style={{
                        minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: '1px solid #fee2e2', borderRadius: 8,
                        color: '#dc2626', fontSize: 16, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      🗑️
                    </button>
                    <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', color: 'var(--ink-deep)' }}>{formatPrice(getItemTotal(item))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Order Summary */}
        <div className="card-checkout-summary" style={{ position: 'sticky', top: 100, marginBottom: 80 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--hairline-soft)', color: 'var(--ink-deep)' }}>Order Summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <Row label="Subtotal" value={formatPrice(subtotal)} />
            <Row label="Delivery Fee" value={deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)} valueColor={deliveryFee === 0 ? 'var(--success)' : undefined} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '2px solid var(--ink-deep)', marginBottom: 24 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-deep)' }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: 24, color: 'var(--primary)' }}>{formatPrice(total)}</span>
          </div>
          <Link href="/checkout" className="btn btn-buy-cta" style={{ width: '100%', padding: '16px 0', fontSize: 16, opacity: items.length === 0 ? 0.5 : 1, pointerEvents: items.length === 0 ? 'none' : 'auto' }}>
            Proceed to Checkout →
          </Link>
          <Link href="/menu" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 14, color: 'var(--primary)', fontWeight: 700 }}>+ Add more items</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--steel)', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 15, color: valueColor || 'var(--ink-deep)' }}>{value}</span>
    </div>
  );
}
