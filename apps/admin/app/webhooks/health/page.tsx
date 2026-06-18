'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Btn, Badge, AdminStyles, T } from '../../ui';
import { getAuthHeaders } from '../../../lib/auth-headers';

export default function WebhookHealthPage() {
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/webhooks/health', { headers: h })
      .then(r => r.json()).then(data => { setHealth(data.checks || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const h2 = getAuthHeaders();
      const data = await fetch('/api/v1/admin/webhooks/health?refresh=true', { headers: h2 }).then(r => r.json());
      setHealth(data.checks || []);
    } catch {
      setHealth([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Running health checks...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="💚" title="Webhook Health"
        right={<Btn variant="primary" onClick={runHealthCheck}>🔄 Run Checks</Btn>}
      />

      {health.length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No webhooks configured. Health checks will appear here once webhooks are set up.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {health.map((check: any) => (
            <Card key={check.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{check.name}</strong>
                  <span style={{ color: T.steel, fontSize: 12, marginLeft: 12 }}>{check.url}</span>
                </div>
                <Badge variant={check.status === 'healthy' ? 'success' : check.status === 'degraded' ? 'warning' : 'danger'}>
                  {check.status || 'unknown'}
                </Badge>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: T.muted }}>
                Last checked: {check.lastCheckedAt ? new Date(check.lastCheckedAt).toLocaleString() : 'Never'} ·
                Latency: {check.latencyMs ? `${check.latencyMs}ms` : '—'} ·
                Success rate: {check.successRate != null ? `${Math.round(check.successRate * 100)}%` : '—'}
              </div>
              {check.error && (
                <div style={{ marginTop: 8, color: '#ef4444', fontSize: 12, background: '#fee2e2', padding: '8px 12px', borderRadius: T.r2 }}>
                  {check.error}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
