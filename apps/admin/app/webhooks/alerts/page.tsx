'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Btn, Badge, DataTable, Tr, Td, AdminStyles, T } from '../../ui';
import { getAuthHeaders } from '../../../lib/auth-headers';

export default function WebhookAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');

  useEffect(() => {
    const h = getAuthHeaders();
    const url = severity ? `/api/v1/admin/webhooks/alerts?severity=${severity}` : '/api/v1/admin/webhooks/alerts';
    fetch(url, { headers: h }).then(r => r.json())
      .then(data => { setAlerts(data.alerts || []); setLoading(false); }).catch(() => setLoading(false));
  }, [severity]);

  const acknowledgeAlert = async (id: number) => {
    try {
      const h2 = getAuthHeaders();
      await fetch(`/api/v1/admin/webhooks/alerts/${id}/acknowledge`, { method: 'POST', headers: h2 });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch {
      // ignore network errors
    }
  };

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading alerts...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="🔔" title="Webhook Alerts"
        subtitle={`${alerts.length} alerts`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'critical', 'warning', 'info'].map(s => (
              <Btn key={s} variant={severity === s ? 'primary' : 'outline'} size="sm" onClick={() => setSeverity(s)}>
                {s || 'All'}
              </Btn>
            ))}
          </div>
        }
      />

      {alerts.length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No alerts. Everything looks healthy.</p></Card>
      ) : (
        <Card padding={0}>
          <DataTable headers={['Time', 'Severity', 'Webhook', 'Message', 'Status', 'Actions']}>
            {alerts.map((a: any) => (
              <Tr key={a.id}>
                <Td style={{ fontSize: 11, color: T.muted }}>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</Td>
                <Td><Badge variant={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}>{a.severity}</Badge></Td>
                <Td bold>{a.webhookName || `#${a.webhookId}`}</Td>
                <Td style={{ fontSize: 13 }}>{a.message}</Td>
                <Td><Badge variant={a.acknowledged ? 'muted' : 'info'}>{a.acknowledged ? 'Acknowledged' : 'New'}</Badge></Td>
                <Td>{!a.acknowledged && <Btn variant="outline" size="sm" onClick={() => acknowledgeAlert(a.id)}>Acknowledge</Btn>}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
}
