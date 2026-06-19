'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRealtimeContext } from './realtime-context';
import { useAuthHeaders } from '../lib/auth-headers';
import { PageHeader, Card, SectionTitle, KpiCard, Btn, Badge, DataTable, Tr, Td, AdminStyles, T } from './ui';
import { SkeletonKpi } from '@kitchen/shared';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState([
    { label: 'Revenue Today', value: '\u2014', change: '', icon: '\uD83D\uDCB0', color: '#dcfce7' },
    { label: 'Orders Today', value: '\u2014', change: '', icon: '\uD83D\uDCE6', color: '#dbeafe' },
    { label: 'Active Orders', value: '\u2014', change: '', icon: '\uD83D\uDD25', color: '#fef3c7' },
    { label: 'Automation Rate', value: '\u2014', change: '', icon: '\uD83E\uDD16', color: '#f3e5f5' },
  ]);

  const h = useAuthHeaders();

  const fetchData = () => {
    Promise.all([
      fetch('/api/v1/admin/orders?limit=10', { headers: h }).then(r => r.ok ? r.json() : []),
      fetch('/api/v1/admin/orders/stats', { headers: h }).then(r => r.ok ? r.json() : null),
    ]).then(([orderData, statsData]) => {
      const orderList = Array.isArray(orderData) ? orderData : orderData?.orders || [];
      setAllOrders(orderList);
      setOrders(orderList.slice(0, 10).map((o: any) => ({
        id: `#${o.id}`, items: o.notes || `Order #${o.id}`,
        amount: parseFloat(o.totalAmount) || 0, status: o.status,
      })));
      if (statsData) {
        const activeCount = (statsData.confirmed || 0) + (statsData.preparing || 0) + (statsData.ready || 0) + (statsData.outForDelivery || 0);
        const totalAll = (statsData.totalToday || 0) + (statsData.delivered || 0) + (statsData.cancelled || 0);
        const autoRate = totalAll > 0 ? `${Math.round(((statsData.delivered || 0) + (statsData.confirmed || 0)) / totalAll * 100)}%` : '\u2014';
        const autoChange = totalAll > 0 ? `${statsData.delivered || 0} of ${totalAll} completed` : 'No data yet';
        setKpis([
          { label: 'Revenue Today', value: `₹${(statsData.revenueToday || 0).toLocaleString()}`, change: `${statsData.totalToday || 0} orders today`, icon: '💰', color: '#dcfce7' },
          { label: 'Orders Today', value: String(statsData.totalToday || 0), change: `${statsData.delivered || 0} delivered`, icon: '\uD83D\uDCE6', color: '#dbeafe' },
          { label: 'Active Orders', value: String(activeCount), change: `${statsData.pending || 0} pending`, icon: '\uD83D\uDD25', color: '#fef3c7' },
          { label: 'Automation Rate', value: autoRate, change: autoChange, icon: '\uD83E\uDD16', color: '#f3e5f5' },
        ]);
      }
    }).catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [h]);

  const { payload, isLive } = useRealtimeContext();

  useEffect(() => {
    if (!payload) return;

    if (payload?.event === 'order.placed' && payload.payload) {
      const p = payload.payload as any;
      setOrders(prev => {
        if (prev.find(o => o.id === `#${p.orderId}`)) return prev;
        return [{ id: `#${p.orderId}`, items: 'New Order', amount: p.totalAmount || 0, status: 'PENDING' }, ...prev].slice(0, 10);
      });
      setKpis(prev => prev.map(k => k.label === 'Orders Today' ? { ...k, value: `${(parseInt(k.value) || 0) + 1}` } : k));
    }
    if (payload?.event?.startsWith('order.') && payload.payload) {
      const p = payload.payload as any;
      const statusMap: Record<string, string> = {
        'order.confirmed': 'CONFIRMED', 
        'order.preparing': 'PREPARING',
        'order.preparation_started': 'PREPARING',
        'order.ready': 'READY', 
        'order.out_for_delivery': 'OUT_FOR_DELIVERY',
        'order.delivered': 'DELIVERED', 
        'order.cancelled': 'CANCELLED',
      };
      const newStatus = statusMap[payload.event];
      if (newStatus && p.orderId) {
        setOrders(prev => prev.map(o => o.id === `#${p.orderId}` ? { ...o, status: newStatus } : o));
      }
    }
  }, [payload]);

  return (
    <div style={{ padding: '4px 0' }}>
      <AdminStyles />
      <PageHeader
        icon="📊" title="Dashboard"
        subtitle={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            <span style={{ color: T.hairline }}>·</span>
            <Badge variant={isLive ? 'success' : 'warning'} pulse>{isLive ? 'Live' : 'Connecting...'}</Badge>
          </span>
        }
        right={
          <>
            <Btn variant="outline" onClick={() => {
              const csvRows = [['ID', 'Items', 'Amount', 'Status']];
              allOrders.forEach((o: any) => csvRows.push([`#${o.id}`, o.notes || `Order #${o.id}`, String(parseFloat(o.totalAmount) || 0), o.status]));
              const csv = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}>⬇️ Export</Btn>
            <Btn variant="primary" onClick={fetchData}>🔃 Refresh</Btn>
          </>
        }
      />

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div style={{ marginBottom: 28 }}><SkeletonKpi count={4} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          {kpis.map(kpi => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Recent Orders */}
        <Card padding={0}>
          <div style={{ padding: '20px 24px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle title="Recent Orders" />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isLive && <span style={{ fontSize: 11, color: T.success, fontWeight: 700 }}>🔴 Auto-refresh</span>}
                <Link href="/orders" style={{ fontSize: 13, color: T.primary, fontWeight: 700 }}>View All →</Link>
              </div>
            </div>
          </div>
          <DataTable headers={['Order', 'Items', 'Amount', 'Status']}>
            {orders.map(row => (
              <Tr key={row.id}>
                <Td bold>{row.id}</Td>
                <Td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.items}</Td>
                <Td bold>₹{row.amount.toLocaleString()}</Td>
                <Td><StatusBadgeInline status={row.status} /></Td>
              </Tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 0', color: T.muted }}>No recent orders found.</td></tr>
            )}
          </DataTable>
        </Card>

        {/* Real-time Event Log */}
        <Card dark padding={24} style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionTitle title="⚡ Event Monitor" color={T.white}
            right={<Badge variant="muted" style={{ fontSize: 10 }}>{isLive ? 'CONNECTED' : 'STANDBY'}</Badge>}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 320, overflowY: 'auto', paddingRight: 4, flex: 1 }}>
            {payload ? (
              <div style={{
                padding: '12px 14px', borderRadius: T.r3,
                background: 'rgba(255,71,87,0.06)', border: '1px solid rgba(255,71,87,0.15)',
                fontSize: 12, fontFamily: 'monospace', animation: 'uiSlideDown 0.25s ease',
              }}>
                <div style={{ fontWeight: 700, color: T.primary, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.primary }} />
                  {payload.event}
                </div>
                <div style={{ color: '#e2e8f0', fontSize: 11, wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: T.r2, lineHeight: 1.4 }}>
                  {JSON.stringify(payload.payload, null, 2)}
                </div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 8, textAlign: 'right' }}>
                  {new Date(payload.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: 13, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: T.r3 }}>
                {isLive ? 'Waiting for events...' : 'Establishing secure stream link...'}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const s: Record<string, { bg: string; text: string; border: string }> = {
    PENDING: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    CONFIRMED: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
    PREPARING: { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
    READY: { bg: '#cffafe', text: '#155e75', border: '#a5f3fc' },
    OUT_FOR_DELIVERY: { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
    DELIVERED: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    CANCELLED: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  };
  const c = s[status] || { bg: T.ghost, text: T.steel, border: T.hairline };
  return (
    <span style={{ padding: '4px 12px', borderRadius: T.r5, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}
