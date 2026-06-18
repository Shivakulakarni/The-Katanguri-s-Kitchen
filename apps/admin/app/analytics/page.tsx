'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, KpiCard, Btn, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AlertTriangle, ClipboardList, DollarSign, BarChart3, CheckCircle } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('today');

  const h = getAuthHeaders();

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/admin/orders/stats?period=${period}`, { headers: h })
      .then(async r => {
        if (!r.ok) throw new Error(`Failed to load analytics (${r.status})`);
        return r.json();
      })
      .then(data => {
        if (!data || typeof data !== 'object') throw new Error('Invalid analytics data');
        setStats(data);
      })
      .catch((err: Error) => {
        setError(err.message || 'Could not load analytics');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [period]);

  if (loading) {
    return (
      <div>
        <AdminStyles />
        <PageHeader icon="📈" title="Analytics" subtitle="Loading..." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {Array(4).fill(null).map((_, i) => (
            <Card key={i} style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: T.muted, fontSize: 14 }}>Loading...</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AdminStyles />
        <PageHeader icon="📈" title="Analytics" subtitle="Error loading data" />
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <AlertTriangle size={48} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Unable to load analytics</h3>
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>{error}</p>
          <Btn variant="primary" onClick={fetchData}>Retry</Btn>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <AdminStyles />
        <PageHeader icon="📈" title="Analytics" subtitle="No data available" />
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No analytics data yet</h3>
          <p style={{ color: T.muted, fontSize: 13 }}>Data will appear once orders start coming in.</p>
        </Card>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Revenue', value: `₹${(stats.revenueToday || 0).toLocaleString()}`, icon: <DollarSign size={24} />, color: '#dcfce7' },
    { label: 'Total Orders', value: String(stats.totalToday || 0), icon: <ClipboardList size={24} />, color: '#dbeafe' },
    { label: 'Avg. Order Value', value: stats.totalToday ? `₹${Math.round((stats.revenueToday || 0) / stats.totalToday).toLocaleString()}` : '—', icon: <BarChart3 size={24} />, color: '#fef3c7' },
    { label: 'Completion Rate', value: stats.totalToday ? `${Math.round(((stats.delivered || 0) / stats.totalToday) * 100)}%` : '—', icon: <CheckCircle size={24} />, color: '#f3e5f5' },
  ];

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="📈" title="Analytics"
        subtitle={period === 'today' ? 'Today\'s performance' : 'Historical data'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {['today', 'week', 'month'].map(p => (
              <Btn key={p} variant={period === p ? 'primary' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Btn>
            ))}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card dark padding={24}>
          <SectionTitle title="Order Status Breakdown" color={T.white} />
          <div style={{ height: 300, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Delivered', value: stats.delivered || 0, color: '#22c55e' },
                    { name: 'Pending', value: stats.pending || 0, color: '#f59e0b' },
                    { name: 'Confirmed', value: stats.confirmed || 0, color: '#3b82f6' },
                    { name: 'Preparing', value: stats.preparing || 0, color: '#8b5cf6' },
                    { name: 'Out for Delivery', value: stats.outForDelivery || 0, color: '#06b6d4' },
                    { name: 'Cancelled', value: stats.cancelled || 0, color: '#ef4444' },
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name"
                >
                  {[
                    { name: 'Delivered', value: stats.delivered || 0, color: '#22c55e' },
                    { name: 'Pending', value: stats.pending || 0, color: '#f59e0b' },
                    { name: 'Confirmed', value: stats.confirmed || 0, color: '#3b82f6' },
                    { name: 'Preparing', value: stats.preparing || 0, color: '#8b5cf6' },
                    { name: 'Out for Delivery', value: stats.outForDelivery || 0, color: '#06b6d4' },
                    { name: 'Cancelled', value: stats.cancelled || 0, color: '#ef4444' },
                  ].filter(d => d.value > 0).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card dark padding={24}>
          <SectionTitle title="Revenue by Period" color={T.white} />
          <div style={{ height: 300, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { period: 'Today', revenue: stats.revenueToday || 0, orders: stats.totalToday || 0 },
                { period: 'This Week', revenue: stats.revenueWeek || 0, orders: stats.totalWeek || 0 },
                { period: 'This Month', revenue: stats.revenueMonth || 0, orders: stats.totalMonth || 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue (₹)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card dark padding={24}>
        <SectionTitle title="Status Breakdown" color={T.white} />
        <div style={{ height: 250, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { status: 'Delivered', count: stats.delivered || 0, fill: '#22c55e' },
              { status: 'Pending', count: stats.pending || 0, fill: '#f59e0b' },
              { status: 'Confirmed', count: stats.confirmed || 0, fill: '#3b82f6' },
              { status: 'Preparing', count: stats.preparing || 0, fill: '#8b5cf6' },
              { status: 'Out', count: stats.outForDelivery || 0, fill: '#06b6d4' },
              { status: 'Cancelled', count: stats.cancelled || 0, fill: '#ef4444' },
            ]} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis dataKey="status" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
              <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                {[
                  { fill: '#22c55e' }, { fill: '#f59e0b' }, { fill: '#3b82f6' }, { fill: '#8b5cf6' }, { fill: '#06b6d4' }, { fill: '#ef4444' },
                ].map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
