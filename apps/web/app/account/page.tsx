'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import Link from 'next/link';
import { useAuthStore } from '../lib/auth-store';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

interface Order { id: number; status: string; totalAmount: string; createdAt: string; notes: string | null; }
interface CustomerProfile { id: number; name: string | null; email: string | null; phone: string; lifetimeValue: string; lastOrderAt: string | null; }

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Quality Check',
  OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

const ACTIVE_STATUSES = new Set(['PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY']);

export default function AccountPage() {
  const { token, user, logout } = useAuthStore();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStatuses, setLiveStatuses] = useState<Record<number, string>>({});
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const sseRefs = useRef<Map<number, EventSource>>(new Map());
  const flashTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const ordersRef = useRef<Order[]>([]);
  const liveStatusesRef = useRef<Record<number, string>>({});

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    Promise.all([
      api.get<CustomerProfile>('/api/v1/customer/profile', token || undefined),
      api.get<{ orders: Order[] }>('/api/v1/orders', token || undefined),
    ]).then(([p, o]) => {
      if (cancelled) return;
      setProfile(p);
      setOrders(o.orders || []);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('Failed to load account data');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { liveStatusesRef.current = liveStatuses; }, [liveStatuses]);

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
    const activeOrders = ordersRef.current.filter(o => {
      const status = liveStatusesRef.current[o.id] || o.status;
      return ACTIVE_STATUSES.has(status);
    });
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
    const activeOrders = orders.filter(o => {
      const status = liveStatusesRef.current[o.id] || o.status;
      return ACTIVE_STATUSES.has(status);
    });
    const existing = sseRefs.current;
    for (const [id, es] of Array.from(existing.entries())) {
      if (!activeOrders.find(o => o.id === id)) { es.close(); existing.delete(id); }
    }
    for (const order of activeOrders) openOrderSSE(order);
  }, [orders, token, openOrderSSE]);

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 48, maxWidth: 780, margin: '0 auto' }}>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 8, color: 'var(--ink-deep)' }}>Sign in to view your account</h2>
          <p style={{ color: 'var(--steel)', marginBottom: 24, fontSize: 16 }}>Track orders, manage addresses, and more</p>
          <Link href="/auth" className="btn btn-buy-cta">Sign In</Link>
        </div>
      </div>
    );
  }

  const initials = profile?.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const displayName = profile?.name || user?.name || 'Guest';

  return (
    <div className="container" style={{ paddingTop: 48, maxWidth: 780, margin: '0 auto' }}>
      <style>{`
        @keyframes accFlash { 0%{background:#fef9c3} 100%{background:transparent} }
        .acc-row-flash { animation: accFlash 2s ease; }
      `}</style>

      <div className="card" style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 'var(--rounded-circle)', background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--primary)', fontWeight: 700 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink-deep)' }}>{displayName}</h1>
          <p style={{ color: 'var(--steel)', fontSize: 14 }}>{profile?.phone || user?.phone || ''}</p>
          {profile && parseFloat(profile.lifetimeValue || '0') > 0 && (
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700, marginTop: 4, display: 'block' }}>
              💰 Total spent: {formatPrice(parseFloat(profile.lifetimeValue))}
            </span>
          )}
        </div>
        <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 20px' }} onClick={() => logout()}>Sign Out</button>
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, color: 'var(--ink-deep)' }}>📋 Recent Orders</h2>
      <div className="card" style={{ overflow: 'hidden', marginBottom: 48 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--stone)' }}>Loading orders...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--critical)' }}>
            <p>{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--stone)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
            <p>No orders yet. <Link href="/menu" style={{ color: 'var(--primary)', fontWeight: 700 }}>Browse the menu</Link>!</p>
          </div>
        ) : orders.map((order, i) => {
          const currentStatus = liveStatuses[order.id] || order.status;
          const isCancelled = currentStatus === 'CANCELLED';
          const isDelivered = currentStatus === 'DELIVERED';
          const isFlashing = flashIds.has(order.id);
          return (
            <Link key={order.id} href={`/track?id=${order.id}`}
              className={isFlashing ? 'acc-row-flash' : ''}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', borderBottom: i < orders.length - 1 ? '1px solid var(--hairline-soft)' : 'none',
                textDecoration: 'none',
              }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--rounded-xl)', background: isCancelled ? 'rgba(228, 30, 63, 0.1)' : isDelivered ? 'rgba(49, 162, 76, 0.1)' : 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {isCancelled ? '❌' : isDelivered ? '✅' : '⏳'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-deep)' }}>#{order.id}</div>
                  <div style={{ fontSize: 13, color: 'var(--steel)' }}>{new Date(order.createdAt).toLocaleDateString()} • {STATUS_LABELS[currentStatus] || currentStatus}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-deep)' }}>{formatPrice(parseFloat(order.totalAmount))}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isCancelled ? 'var(--critical)' : isDelivered ? 'var(--success)' : 'var(--primary)' }}>
                  {STATUS_LABELS[currentStatus] || currentStatus}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
