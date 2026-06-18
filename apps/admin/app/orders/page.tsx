'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader, Card, Btn, Badge, FilterBar, DataTable, Tr, Td, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast } from '../../lib/toast-store';

type Order = { id: number; status: string; totalAmount: string; createdAt: string; customerId: number | null; notes: string | null; };

const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'], READY: ['OUT_FOR_DELIVERY'], OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [], CANCELLED: [],
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  CONFIRMED: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  PREPARING: { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  READY: { bg: '#cffafe', text: '#155e75', border: '#a5f3fc' },
  OUT_FOR_DELIVERY: { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  DELIVERED: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  CANCELLED: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const sseRef = useRef<EventSource | null>(null);

  const fetchOrders = useCallback(async (status?: string, signal?: AbortSignal) => {
    try {
      const url = status ? `/api/v1/admin/orders?status=${status}&limit=100` : '/api/v1/admin/orders?limit=100';
      const h = getAuthHeaders();
      const res = await fetch(url, { headers: h, signal });
      if (!res.ok) { 
        toast.error('Failed to load orders', 'Check your connection and try again');
        setOrders([]); 
        setLoading(false); 
        return; 
      }
      const data = await res.json();
      setOrders(data.data || data.orders || []);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('Failed to load orders', err.message || 'Network error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const es = new EventSource('/api/v1/admin/orders/stream', { withCredentials: true });
    sseRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'order.placed') {
          setNewOrderIds(prev => new Set(prev).add(data.payload.orderId));
          setTimeout(() => setNewOrderIds(prev => { const next = new Set(prev); next.delete(data.payload.orderId); return next; }), 4000);
        }
        const statusMap: Record<string, string> = {
          'order.confirmed': 'CONFIRMED', 'order.preparing': 'PREPARING', 'order.ready': 'READY',
          'order.out_for_delivery': 'OUT_FOR_DELIVERY', 'order.delivered': 'DELIVERED', 'order.cancelled': 'CANCELLED',
        };
        if (statusMap[data.event] && data.payload.orderId) {
          setOrders(prev => prev.map(o => o.id === data.payload.orderId ? { ...o, status: statusMap[data.event] } : o));
        }
      } catch {
        // ignore JSON parse/event errors
      }
    };
    fetchOrders(undefined, controller.signal);
    return () => { controller.abort(); es.close(); };
  }, [fetchOrders]);

  const statusCounts: Record<string, number> = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  const filteredOrders = orders.filter(o => {
    if (filter && o.status !== filter) return false;
    if (search && !String(o.id).includes(search) && !(o.notes || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(o.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      setUpdating(id);
      const h = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/orders/${id}/status`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error('Failed to update status');
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setFlash(id); setTimeout(() => setFlash(null), 1500);
    } catch (err: any) {
      toast.error('Update failed', err.message || 'Failed to update order status');
    } finally {
      setUpdating(null);
    }
  };

  const statuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

  return (
    <div>
      <AdminStyles />
      <PageHeader title="Orders"
        subtitle={loading ? 'Loading...' : `${orders.length} total`}
        right={<Badge variant={connected ? 'success' : 'danger'} pulse>{connected ? '🔴 Live' : '📡 Reconnecting...'}</Badge>}
      />

      <FilterBar>
        <input
          type="text"
          placeholder="Search by ID or notes..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '6px 12px', borderRadius: T.r3, border: `1px solid ${T.hairline}`, fontSize: 13, width: 180 }}
        />
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          style={{ padding: '6px 12px', borderRadius: T.r3, border: `1px solid ${T.hairline}`, fontSize: 13 }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          style={{ padding: '6px 12px', borderRadius: T.r3, border: `1px solid ${T.hairline}`, fontSize: 13 }}
        />
        <Btn variant={!filter ? 'primary' : 'outline'} size="sm" onClick={() => { setFilter(''); setPage(1); }}>All ({orders.length})</Btn>
        {statuses.map(s => (
          <Btn key={s} variant={filter === s ? 'primary' : 'outline'} size="sm" onClick={() => { setFilter(s); setPage(1); }}>
            {s} ({statusCounts[s] || 0})
          </Btn>
        ))}
      </FilterBar>

      <Card padding={0} style={{ marginTop: 16 }}>
        <DataTable headers={['ID', 'Status', 'Amount', 'Date', 'Notes', 'Actions']}>
          {paginatedOrders.map(o => {
            const c = STATUS_COLORS[o.status] || {};
            return (
              <Tr key={o.id} style={newOrderIds.has(o.id) ? { background: 'rgba(34,197,94,0.08)', transition: 'background 0.5s' } : flash === o.id ? { background: 'rgba(59,130,246,0.08)', transition: 'background 0.3s' } : {}}>
                <Td bold style={{ fontFamily: 'monospace', fontSize: 12 }}>#{o.id}</Td>
                <Td><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{o.status}</span></Td>
                <Td bold>₹{parseFloat(o.totalAmount).toLocaleString()}</Td>
                <Td style={{ fontSize: 12, color: T.muted }}>{new Date(o.createdAt).toLocaleDateString()}</Td>
                <Td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.steel }}>{o.notes || '—'}</Td>
                <Td><div style={{ display: 'flex', gap: 4 }}>
                  {STATUS_FLOW[o.status]?.map(nextStatus => (
                    <Btn key={nextStatus} variant="outline" size="sm"
                      onClick={() => updateStatus(o.id, nextStatus)}
                      disabled={updating === o.id}
                      style={nextStatus === 'CANCELLED' ? { color: '#ef4444', borderColor: '#fca5a5' } : {}}>
                      {nextStatus === 'CANCELLED' ? '✕' : nextStatus.replace(/_/g, ' ')}
                    </Btn>
                  ))}
                </div></Td>
              </Tr>
            );
          })}
          {filteredOrders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: T.muted }}>No orders found.</td></tr>}
        </DataTable>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16, borderTop: `1px solid ${T.hairline}` }}>
            <Btn variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Btn>
            <span style={{ fontSize: 13, color: T.muted }}>Page {page} of {totalPages}</span>
            <Btn variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
