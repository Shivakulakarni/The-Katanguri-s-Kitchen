'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Badge, DataTable, Tr, Td, Field, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast } from '../../lib/toast-store';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newHook, setNewHook] = useState({ name: '', url: '', events: 'order.placed' });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/webhooks', { headers: h }).then(r => r.json())
      .then(data => { setWebhooks(data.webhooks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const createWebhook = async () => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch('/api/v1/admin/webhooks', {
        method: 'POST', headers: h2, body: JSON.stringify({ ...newHook, events: newHook.events.split(',').map(s => s.trim()) }),
      });
      if (!res.ok) throw new Error('Failed to create webhook');
      const data = await res.json();
      if (data.webhook) setWebhooks(prev => [...prev, data.webhook]);
      setShowForm(false);
      setNewHook({ name: '', url: '', events: 'order.placed' });
    } catch (err: any) { toast.error('Create failed', err.message || 'Failed to create webhook'); }
  };

  const toggleWebhook = async (id: number) => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/webhooks/${id}/toggle`, { method: 'POST', headers: h2 });
      if (!res.ok) throw new Error('Failed to toggle webhook');
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w));
    } catch (err: any) { toast.error('Toggle failed', err.message || 'Failed to toggle webhook'); }
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/webhooks/${id}`, { method: 'DELETE', headers: h2 });
      if (!res.ok) throw new Error('Failed to delete webhook');
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch (err: any) { toast.error('Delete failed', err.message || 'Failed to delete webhook'); }
  };

  const testWebhook = async (id: number) => {
    const h2 = getAuthHeaders();
    setTestResult('Testing...');
    try {
      const res = await fetch(`/api/v1/admin/webhooks/${id}/test`, { method: 'POST', headers: h2 });
      const data = await res.json();
      setTestResult(data.success ? '✅ Success' : `❌ Failed: ${data.error || 'Unknown'}`);
    } catch { setTestResult('❌ Network error'); }
    setTimeout(() => setTestResult(null), 3000);
  };

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading webhooks...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="🔗" title="Webhooks"
        subtitle={`${webhooks.length} endpoints configured`}
        right={<Btn variant="primary" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Cancel' : '+ Add Webhook'}</Btn>}
      />

      {testResult && (
        <div style={{ padding: '12px 16px', marginBottom: 16, borderRadius: T.r3, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 13, fontWeight: 600 }}>
          {testResult}
        </div>
      )}

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title="New Webhook" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Name"><input value={newHook.name} onChange={e => setNewHook({ ...newHook, name: e.target.value })} /></Field>
            <Field label="Endpoint URL"><input value={newHook.url} onChange={e => setNewHook({ ...newHook, url: e.target.value })} placeholder="https://example.com/webhook" style={{ width: 400 }} /></Field>
            <Field label="Events (comma-separated)"><input value={newHook.events} onChange={e => setNewHook({ ...newHook, events: e.target.value })} style={{ width: 300 }} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Btn variant="primary" onClick={createWebhook} disabled={!newHook.name || !newHook.url}>Create</Btn></div>
        </Card>
      )}

      <Card padding={0}>
        <DataTable headers={['ID', 'Name', 'URL', 'Events', 'Active', 'Last Triggered', 'Actions']}>
          {webhooks.map(w => (
            <Tr key={w.id}>
              <Td muted style={{ fontFamily: 'monospace' }}>{w.id}</Td>
              <Td bold>{w.name}</Td>
              <Td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{w.url}</Td>
              <Td style={{ fontSize: 11 }}>{(w.events || []).join(', ')}</Td>
              <Td><Badge variant={w.isActive ? 'success' : 'muted'}>{w.isActive ? 'ON' : 'OFF'}</Badge></Td>
              <Td muted style={{ fontSize: 11 }}>{w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : '—'}</Td>
              <Td><div style={{ display: 'flex', gap: 4 }}>
                <Btn variant="outline" size="sm" onClick={() => testWebhook(w.id)}>Test</Btn>
                <Btn variant="outline" size="sm" onClick={() => toggleWebhook(w.id)}>{w.isActive ? 'Disable' : 'Enable'}</Btn>
                <Btn variant="outline" size="sm" onClick={() => deleteWebhook(w.id)} style={{ color: '#ef4444' }}>🗑</Btn>
              </div></Td>
            </Tr>
          ))}
          {webhooks.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: T.muted }}>No webhooks configured.</td></tr>}
        </DataTable>
      </Card>
    </div>
  );
}
