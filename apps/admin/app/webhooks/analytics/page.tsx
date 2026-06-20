'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Badge, AdminStyles, T } from '../../ui';
import { getAuthHeaders } from '../../../lib/auth-headers';

export default function WebhookAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const h = getAuthHeaders();
    fetch(`/api/v1/admin/webhooks/analytics?days=${days}`, { headers: h })
      .then(r => r.ok ? r.json() : null).then(data => {
        setAnalytics(data);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [days]);

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading analytics...</div>;

  const totalOrders = analytics?.totalOrders || 0;
  const statusCounts = analytics?.statusCounts || {};
  const sourceCounts = analytics?.sourceCounts || {};
  const dailyBySource = analytics?.dailyBySource || [];
  const avgProcessingTime = analytics?.avgProcessingTimeSeconds || 0;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="📊" title="Incoming Webhook Analytics"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {[7, 30, 90].map(d => (
              <Btn key={d} variant={days === d ? 'primary' : 'outline'} size="sm" onClick={() => setDays(d)}>
                {d}d
              </Btn>
            ))}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <Card><SectionTitle title={`Total Orders: ${totalOrders}`} /></Card>
        <Card><SectionTitle title={`Created: ${statusCounts['created'] || 0}`} right={<Badge variant="success">✓</Badge>} /></Card>
        <Card><SectionTitle title={`Failed: ${statusCounts['failed'] || 0}`} right={statusCounts['failed'] > 0 ? <Badge variant="danger">⚠</Badge> : <Badge variant="success">✓</Badge>} /></Card>
        <Card><SectionTitle title={`Avg Processing: ${avgProcessingTime ? `${avgProcessingTime.toFixed(1)}s` : '—'}`} /></Card>
      </div>

      {Object.keys(sourceCounts).length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title="Orders by Source" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(sourceCounts).map(([source, count]: [string, any]) => (
              <div key={source} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderRadius: T.r2, background: T.ghost }}>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{source}</span>
                <span style={{ color: T.steel }}>{count} orders</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Object.keys(statusCounts).length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title="Status Breakdown" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(statusCounts).map(([status, count]: [string, any]) => (
              <Badge key={status} variant={status === 'failed' ? 'danger' : status === 'created' ? 'success' : 'info'}>
                {status}: {count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {dailyBySource.length > 0 && (
        <Card>
          <SectionTitle title="Daily Volume" />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {dailyBySource.map((row: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.hairline}`, fontSize: 13 }}>
                <span>{row.date}</span>
                <span style={{ textTransform: 'capitalize', color: T.steel }}>{row.source}</span>
                <span style={{ fontWeight: 600 }}>{row.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {totalOrders === 0 && (
        <Card><p style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No incoming webhook data available yet.</p></Card>
      )}
    </div>
  );
}
