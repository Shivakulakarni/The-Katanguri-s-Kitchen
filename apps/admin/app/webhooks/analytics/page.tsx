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
        if (data && typeof data === 'object') {
          setAnalytics({ ...data, webhooks: Array.isArray(data.webhooks) ? data.webhooks : [] });
        } else {
          setAnalytics(null);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [days]);

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading analytics...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="📊" title="Webhook Analytics"
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
        <Card><SectionTitle title={`Total Sent: ${analytics?.totalSent || 0}`} /></Card>
        <Card><SectionTitle title={`Successful: ${analytics?.successful || 0}`} right={<Badge variant="success">{analytics?.totalSent ? `${Math.round((analytics.successful / analytics.totalSent) * 100)}%` : '—'}</Badge>} /></Card>
        <Card><SectionTitle title={`Failed: ${analytics?.failed || 0}`} right={analytics?.failed > 0 ? <Badge variant="danger">⚠</Badge> : <Badge variant="success">✓</Badge>} /></Card>
        <Card><SectionTitle title={`Avg Latency: ${analytics?.avgLatencyMs ? `${Math.round(analytics.avgLatencyMs)}ms` : '—'}`} /></Card>
      </div>

      {(!analytics || !analytics.webhooks || analytics.webhooks.length === 0) ? (
        <Card><p style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No webhook analytics data available yet.</p></Card>
      ) : (
        <Card>
          <SectionTitle title="Per-Webhook Breakdown" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analytics.webhooks.map((w: any) => (
              <div key={w.id} style={{ padding: 16, borderRadius: T.r3, border: `1px solid ${T.hairline}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{w.name}</strong>
                  <Badge variant={w.failureRate > 0.1 ? 'danger' : 'success'}>{Math.round((1 - w.failureRate) * 100)}% success</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.steel }}>
                  {w.sent} sent · {w.successful} ok · {w.failed} failed · avg {(w.avgLatencyMs || 0).toFixed(0)}ms
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
