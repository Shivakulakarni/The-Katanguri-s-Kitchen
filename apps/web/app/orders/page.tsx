'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '../lib/auth-store';
import { useCartStore } from '../lib/cart-store';
import { api } from '../lib/api';
import { toast } from '../lib/toast-store';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

type Order = {
  id: number;
  status: string;
  totalAmount: string;
  createdAt: string;
  notes: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:          { label: 'Order Placed',      color: '#92400e', bg: '#fef3c7', icon: '📝' },
  CONFIRMED:        { label: 'Confirmed',          color: '#1e40af', bg: '#dbeafe', icon: '✅' },
  PREPARING:        { label: 'Preparing',          color: '#5b21b6', bg: '#ede9fe', icon: '👨‍🍳' },
  READY:            { label: 'Ready for Pickup',   color: '#155e75', bg: '#cffafe', icon: '🍱' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',   color: '#14532d', bg: '#dcfce7', icon: '🛵' },
  DELIVERED:        { label: 'Delivered',           color: '#166534', bg: '#f0fdf4', icon: '🎉' },
  CANCELLED:        { label: 'Cancelled',           color: '#991b1b', bg: '#fee2e2', icon: '❌' },
};

const ACTIVE_STATUSES = new Set(['PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY']);

export default function MyOrdersPage() {
  const { token, user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStatuses, setLiveStatuses] = useState<Record<number, string>>({});
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const sseRefs = useRef<Map<number, EventSource>>(new Map());
  const flashTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const ordersRef = useRef<Order[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!token || !user) return;
    try {
      const data = await api.get('/api/v1/orders', token || undefined);
      const list: Order[] = data.orders || [];
      setOrders(list);
    } catch {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const ac = new AbortController();
    fetchOrders();
    return () => ac.abort();
  }, [fetchOrders]);

  useEffect(() => { ordersRef.current = orders; }, [orders]);

  const openOrderSSE = useCallback((order: Order) => {
    const existing = sseRefs.current;
    if (existing.has(order.id)) return;
    const es = new EventSource(`/api/v1/orders/${order.id}/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'status_change' && evt.payload?.status) {
          const newStatus = evt.payload.status;
          setLiveStatuses(prev => ({ ...prev, [order.id]: newStatus }));
          setFlashIds(prev => {
            const s = new Set(prev);
            s.add(order.id);
            return s;
          });
          if (flashTimeouts.current.has(order.id)) clearTimeout(flashTimeouts.current.get(order.id)!);
          flashTimeouts.current.set(order.id, setTimeout(() => {
            setFlashIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
            flashTimeouts.current.delete(order.id);
          }, 2000));
          if (!ACTIVE_STATUSES.has(newStatus)) {
            es.close();
            existing.delete(order.id);
          }
        }
      } catch { /* SSE connection failed — will retry on next effect */ }
    };
    existing.set(order.id, es);
  }, []);

  // SSE connections — depends only on user
  useEffect(() => {
    if (!user) return;
    const activeOrders = ordersRef.current.filter(o => ACTIVE_STATUSES.has(o.status));
    for (const order of activeOrders) openOrderSSE(order);
    return () => {
      for (const es of Array.from(sseRefs.current.values())) es.close();
      sseRefs.current.clear();
      for (const t of flashTimeouts.current.values()) clearTimeout(t);
      flashTimeouts.current.clear();
    };
  }, [token, openOrderSSE]);

  // Re-sync SSE when orders change — opens new, closes stale
  useEffect(() => {
    if (!user || orders.length === 0) return;
    const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status));
    const existing = sseRefs.current;
    for (const [id, es] of Array.from(existing.entries())) {
      if (!activeOrders.find(o => o.id === id)) { es.close(); existing.delete(id); }
    }
    for (const order of activeOrders) openOrderSSE(order);
  }, [orders.length, token, openOrderSSE]);

  const getStatus = (order: Order) => liveStatuses[order.id] || order.status;

  const handleReorder = useCallback(async (orderId: number) => {
    try {
      const data = await api.get(`/api/v1/orders/${orderId}`, token || undefined);
      if (data?.items?.length) {
        const { addItem } = useCartStore.getState();
        for (const item of data.items) {
          addItem({
            id: item.dishId,
            name: item.dishName || `Dish #${item.dishId}`,
            price: parseFloat(item.unitPrice),
            veg: true,
            image: '',
            modifiers: item.modifiers || [],
          });
        }
        toast.success('Added to cart', `${data.items.length} item(s) added from Order #${orderId}`);
      }
    } catch {
      toast.error('Reorder failed', 'Could not load order details');
    }
  }, [token]);

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(getStatus(o)));
  const pastOrders   = orders.filter(o => !ACTIVE_STATUSES.has(getStatus(o)));

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--ink-deep)' }}>Sign in to view your orders</h2>
        <p style={{ color: 'var(--steel)', marginBottom: 24 }}>Track your deliveries in real-time</p>
        <Link href="/auth" className="btn btn-buy-cta" style={{ fontSize: 15, padding: '12px 32px' }}>Sign In</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <style>{`
        @keyframes moFlash { 0%{background:#fef9c3} 100%{background:transparent} }
        @keyframes moPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .mo-row-flash { animation: moFlash 2s ease; }
        .mo-row { transition: box-shadow 0.2s; }
        .mo-row:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      `}</style>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink-deep)', margin: 0 }}>My Orders</h1>
        <p style={{ color: 'var(--steel)', fontSize: 14, marginTop: 6 }}>
          {user?.name ? `Hey ${user.name.split(' ')[0]}!` : ''} {activeOrders.length > 0 ? `${activeOrders.length} active order${activeOrders.length > 1 ? 's' : ''} tracking live` : 'All your orders'}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 100, borderRadius: 16, background: 'var(--surface-soft)',
              animation: 'moPulse 1.5s infinite' }} />
          ))}
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>{error}</h2>
          <button className="btn btn-primary" onClick={fetchOrders} style={{ marginTop: 12 }}>Try Again</button>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🍽️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>No orders yet</h2>
          <p style={{ color: 'var(--steel)', marginBottom: 24 }}>Your order history will appear here</p>
          <Link href="/menu" className="btn btn-primary" style={{ fontSize: 15, padding: '12px 32px' }}>Order Now 🛍️</Link>
        </div>
      ) : (
        <>
          {/* Active Orders — live tracked */}
          {activeOrders.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', margin: 0 }}>🔴 Live Orders</h2>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                  borderRadius: 20, background: '#fee2e2', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
                    display: 'inline-block', animation: 'moPulse 1s infinite' }} />
                  TRACKING LIVE
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-live="polite" aria-label="Active order updates">
                {activeOrders.map(order => {
                  const status = getStatus(order);
                  const meta = STATUS_META[status] || STATUS_META.PENDING;
                  const isFlashing = flashIds.has(order.id);
                  return (
                    <Link key={order.id} href={`/track?id=${order.id}`}
                      className={`mo-row${isFlashing ? ' mo-row-flash' : ''}`}
                      style={{
                        display: 'block', textDecoration: 'none', borderRadius: 16,
                        border: `2px solid ${meta.bg}`,
                        background: meta.bg, padding: '16px 20px',
                        cursor: 'pointer',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 20 }}>{meta.icon}</span>
                            <span style={{ fontWeight: 800, fontSize: 16, color: meta.color }}>
                              {meta.label}
                            </span>
                            {isFlashing && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                                background: '#fff', color: meta.color, fontWeight: 700, border: `1px solid ${meta.color}` }}>
                                UPDATED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: meta.color, opacity: 0.8 }}>
                            Order #{order.id} · {formatPrice(parseFloat(order.totalAmount))}
                          </div>
                          {order.notes && (
                            <div style={{ fontSize: 12, color: meta.color, opacity: 0.6, marginTop: 2 }}>
                              📍 {order.notes.slice(0, 50)}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: meta.color, opacity: 0.87 }}>
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div style={{ fontSize: 13, color: meta.color, fontWeight: 700, marginTop: 6 }}>
                            Track Live →
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Orders */}
          {pastOrders.length > 0 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 16 }}>
                Past Orders
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pastOrders.map(order => {
                  const status = getStatus(order);
                  const meta = STATUS_META[status] || STATUS_META.DELIVERED;
                  return (
                    <div key={order.id} className="mo-row" style={{
                      background: 'var(--canvas)', borderRadius: 14,
                      border: '1px solid var(--hairline-soft)',
                      padding: '14px 20px', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14 }}>{meta.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-deep)' }}>
                            Order #{order.id}
                          </span>
                          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11,
                            fontWeight: 700, background: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--steel)' }}>
                          {new Date(order.createdAt).toLocaleDateString()} · {formatPrice(parseFloat(order.totalAmount))}
                        </div>
                      </div>
                      <Link href={`/track?id=${order.id}`}
                        style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                        View →
                      </Link>
                      <button
                        onClick={() => handleReorder(order.id)}
                        style={{ fontSize: 13, color: 'var(--success, #2e7d32)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                      >
                        Reorder →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
