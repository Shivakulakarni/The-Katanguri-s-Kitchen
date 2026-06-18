'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Btn, Badge, DataTable, Tr, Td, AdminStyles, T } from '../../ui';
import { getAuthHeaders } from '../../../lib/auth-headers';

export default function WebhookReplayPage() {
  const [replays, setReplays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState<number | null>(null);

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/webhooks/replay/history', { headers: h })
      .then(r => r.json())
      .then(data => { setReplays(data.replays || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const triggerReplay = async (deliveryId: number) => {
    setReplaying(deliveryId);
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/webhooks/replay/${deliveryId}`, { method: 'POST', headers: h2 });
      const data = await res.json();
      if (data.replay) setReplays(prev => [data.replay, ...prev]);
    } catch {
      // ignore network errors
    } finally {
      setReplaying(null);
    }
  };

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading replay history...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="🔄" title="Webhook Replay" subtitle="Retry failed webhook deliveries" />

      {replays.length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No webhook replays yet. Failed deliveries will appear here for retry.</p></Card>
      ) : (
        <Card padding={0}>
          <DataTable headers={['Delivery ID', 'Webhook', 'Event', 'Attempts', 'Last Error', 'Status', 'Actions']}>
            {replays.map((r: any) => (
              <Tr key={r.id}>
                <Td style={{ fontFamily: 'monospace', fontSize: 12 }}>#{r.deliveryId || r.id}</Td>
                <Td bold>{r.webhookName || `#${r.webhookId}`}</Td>
                <Td style={{ fontSize: 11 }}>{r.event}</Td>
                <Td>{r.attempts || 0}</Td>
                <Td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ef4444', fontSize: 12 }}>{r.lastError || '—'}</Td>
                <Td><Badge variant={r.status === 'delivered' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{r.status || 'pending'}</Badge></Td>
                <Td>
                  <Btn variant="outline" size="sm" onClick={() => triggerReplay(r.deliveryId || r.id)} disabled={replaying === (r.deliveryId || r.id)}>
                    {replaying === (r.deliveryId || r.id) ? '...' : 'Replay'}
                  </Btn>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
}
