'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast } from '../../lib/toast-store';

type OrderItem = {
  id: number;
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: string;
  modifiers: any[];
  isVeg: boolean | null;
};

type Order = {
  id: number;
  status: string;
  totalAmount: string;
  createdAt: string;
  notes: string | null;
  customerId: number | null;
  items: OrderItem[];
};

const KDS_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as const;

const STATUS_META = {
  PENDING:   { label: 'New Order',  color: '#92400e', bg: '#fef3c7', border: '#fde68a', icon: '\uD83D\uDD14', next: 'CONFIRMED' as string },
  CONFIRMED: { label: 'Confirmed',  color: '#1e40af', bg: '#dbeafe', border: '#bfdbfe', icon: '\u2705', next: 'PREPARING' as string },
  PREPARING: { label: 'Preparing',  color: '#5b21b6', bg: '#ede9fe', border: '#ddd6fe', icon: '\uD83D\uDC68\u200D\uD83C\uDF73', next: 'READY' as string },
  READY:     { label: 'Ready',      color: '#155e75', bg: '#cffafe', border: '#a5f3fc', icon: '\uD83C\uDF71', next: 'OUT_FOR_DELIVERY' as string },
};

const NEXT_LABEL: Record<string, string> = {
  CONFIRMED: 'Start Preparing \u2192',
  PREPARING: 'Mark Ready \u2192',
  READY:     'Dispatch \u2192',
  PENDING:   'Confirm \u2192',
};

function timeAgo(dateStr: string) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      osc2.connect(gain);
      osc2.frequency.value = 1000;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.15);
    }, 200);
  } catch { /* Audio not available */ }
}

function useTimer() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);
  return tick;
}

export default function KDSPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [alertIds, setAlertIds] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(new Date());
  useTimer();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
    const h = getAuthHeaders();
    const res = await fetch('/api/v1/admin/orders?limit=200', { headers: h });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    const list: Order[] = (data.data || data.orders || []).filter((o: Order) => KDS_STATUSES.includes(o.status as any));
    setOrders(list);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const h = getAuthHeaders();
    const token = h['Authorization']?.replace('Bearer ', '');
    if (!token) return;
    const es = new EventSource(`/api/v1/admin/orders/stream`, { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'order.placed') {
          playBeep();
          fetchOrders();
          if (data.payload?.orderId) {
            setAlertIds(prev => new Set(prev).add(data.payload.orderId));
            setTimeout(() => setAlertIds(prev => { const next = new Set(prev); next.delete(data.payload.orderId); return next; }), 5000);
          }
        }
        const liveStatuses: Record<string, string> = {
          'order.confirmed': 'CONFIRMED', 'order.preparing': 'PREPARING', 'order.ready': 'READY',
        };
        const updatedStatus = liveStatuses[data.event];
        if (updatedStatus && data.payload?.orderId) {
          setOrders(prev => prev.map(o => o.id === data.payload.orderId ? { ...o, status: updatedStatus } : o));
        }
        if (['order.out_for_delivery', 'order.delivered', 'order.cancelled'].includes(data.event) && data.payload?.orderId) {
          setOrders(prev => prev.filter(o => o.id !== data.payload.orderId));
        }
      } catch {
        // ignore JSON parse/event errors
      }
    };
    return () => es.close();
  }, [fetchOrders]);

  const updateStatus = async (id: number, newStatus: string) => {
    setUpdating(id);
    try {
      const h = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/orders/${id}/status`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      }
    } catch {
      toast.error('Status update failed', 'Order will re-sync on next update');
    } finally {
      setUpdating(null);
    }
  };

  const statusOrder = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];

  const columns = statusOrder.map(status => {
    const meta = STATUS_META[status as keyof typeof STATUS_META];
    const columnOrders = orders.filter(o => o.status === status);
    return { status, meta, orders: columnOrders };
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1219', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
        Loading kitchen display...
      </div>
    );
  }

    return (
      <div style={{ minHeight: '100vh', background: '#0f1219', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', background: '#1a1f2e', borderBottom: '1px solid #2d3548', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Image src="/logo-kitchen.png" alt="Logo" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
              <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5, color: '#e2e8f0' }}>The Katanguri's Kitchen</span>
            </div>
            <span style={{ margin: '0 12px', color: '#475569' }}>|</span>
            <span style={{ fontSize: 14, color: '#94a3b8' }}>Kitchen Display System</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
            <span>{now.toLocaleTimeString()}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
              {connected ? 'Live' : 'Disconnected'}
            </span>
            <span style={{ color: '#64748b' }}>{orders.length} orders</span>
          </div>
        </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: 16, flex: 1, overflow: 'hidden' }}>
        {columns.map(col => (
          <div key={col.status} style={{
            background: '#1a1f2e', borderRadius: 12, display: 'flex', flexDirection: 'column',
            border: '1px solid #2d3548', overflow: 'hidden',
          }}>
            {/* Column Header */}
            <div style={{
              padding: '14px 16px', background: col.meta.bg, color: col.meta.color,
              fontWeight: 800, fontSize: 14, display: 'flex', justifyContent: 'space-between',
              borderBottom: `2px solid ${col.meta.border}`,
            }}>
              <span>{col.meta.icon} {col.meta.label}</span>
              <span style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 10px', borderRadius: 12, fontSize: 13 }}>{col.orders.length}</span>
            </div>

            {/* Column Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {col.orders.map(o => {
                const isAlert = alertIds.has(o.id);
                return (
                  <div key={o.id} style={{
                    background: isAlert ? '#1e293b' : '#111521',
                    borderRadius: 10, padding: 16,
                    border: isAlert ? '2px solid #f59e0b' : '1px solid #2d3548',
                    animation: isAlert ? 'pulse 1s ease-in-out 3' : undefined,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>#{o.id}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{timeAgo(o.createdAt)}</span>
                    </div>
                    {/* Order Items */}
                    {o.items && o.items.length > 0 && (
                      <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {o.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                              background: item.isVeg ? '#22c55e' : '#ef4444',
                              border: `1px solid ${item.isVeg ? '#16a34a' : '#dc2626'}`,
                            }} />
                            <span style={{ color: '#e2e8f0', fontWeight: 600, flex: 1 }}>
                              {item.quantity}x {item.dishName}
                            </span>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <span style={{ fontSize: 10, color: '#64748b' }}>
                                +{item.modifiers.length}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {o.notes && (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8, fontStyle: 'italic' }}>
                        Note: {o.notes}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      Amount: <strong style={{ color: '#e2e8f0' }}>₹{parseFloat(o.totalAmount).toLocaleString()}</strong>
                    </div>
                    {col.meta.next && (
                      <button onClick={() => updateStatus(o.id, col.meta.next)}
                        disabled={updating === o.id}
                        style={{
                          width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 700,
                          background: col.meta.color, color: '#fff', border: 'none', borderRadius: 8,
                          cursor: updating === o.id ? 'wait' : 'pointer', opacity: updating === o.id ? 0.6 : 1,
                          fontFamily: 'inherit',
                        }}>
                        {updating === o.id ? '...' : NEXT_LABEL[col.status] || col.meta.next}
                      </button>
                    )}
                  </div>
                );
              })}
              {col.orders.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#475569', fontSize: 13 }}>
                  No orders
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
        }
      `}</style>
    </div>
  );
}
