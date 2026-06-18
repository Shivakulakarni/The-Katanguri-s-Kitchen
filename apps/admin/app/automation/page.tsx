'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, KpiCard, Btn, Badge, DataTable, Tr, Td, Field, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast } from '../../lib/toast-store';

export default function AutomationPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', trigger: '', conditions: '[]', actions: '[]' });
  const [workflows, setWorkflows] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-workflows');
      if (saved) return JSON.parse(saved);
    }
    return {
      'order-to-kitchen': true,
      'payment-confirmation': true,
      'dispatch-assignment': true,
      'customer-communication': true,
      'inventory-low-stock': true,
      'payment-reconciliation': true
    };
  });

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/automation/rules', { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRules(Array.isArray(data) ? data : []));
    fetch('/api/v1/admin/automation/stats', { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(data => setStats(data));
    fetch('/api/v1/admin/automation/logs?limit=20', { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then(data => setLogs(Array.isArray(data) ? data : []));
  }, []);

  const refreshRules = () => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/automation/rules', { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRules(Array.isArray(data) ? data : []));
  };

  const toggleRule = async (id: number) => {
    const h = getAuthHeaders();
    await fetch(`/api/v1/admin/automation/rules/${id}/toggle`, { method: 'POST', headers: h });
    refreshRules();
  };

  const createRule = async () => {
    try {
      const conditions = JSON.parse(newRule.conditions || '[]');
      const actions = JSON.parse(newRule.actions || '[]');
      const h2 = getAuthHeaders();
      const res = await fetch('/api/v1/admin/automation/rules', {
        method: 'POST', headers: h2,
        body: JSON.stringify({ name: newRule.name, trigger: newRule.trigger, conditions, actions }),
      });
      if (!res.ok) throw new Error('Failed to create rule');
      setShowNewRule(false);
      setNewRule({ name: '', trigger: '', conditions: '[]', actions: '[]' });
      refreshRules();
    } catch (err: any) {
      toast.error('Create failed', err.message || 'Invalid JSON in conditions or actions');
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm('Delete this rule?')) return;
    const h = getAuthHeaders();
    await fetch(`/api/v1/admin/automation/rules/${id}`, { method: 'DELETE', headers: h });
    refreshRules();
  };

  const toggleWorkflow = (key: string) => {
    setWorkflows(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('admin-workflows', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="⚡" title="Automation"
        subtitle={`${rules.length} rules · ${stats?.totalExecutions || 0} total executions`}
        right={<Btn variant="primary" onClick={() => setShowNewRule(!showNewRule)}>{showNewRule ? '✕ Cancel' : '+ New Rule'}</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Rules Active" value={String(rules.filter(r => r.isActive).length)} icon="⚡" color="#dcfce7" />
        <KpiCard label="Triggered Today" value={String(stats?.todayExecutions || 0)} icon="🎯" color="#dbeafe" />
        <KpiCard label="Success Rate" value={stats?.todayExecutions ? `${Math.round((stats?.todayExecutions - stats?.todayErrors) / stats?.todayExecutions * 100)}%` : '—'} icon="✅" color="#fef3c7" />
        <KpiCard label="Active Workflows" value={String(Object.values(workflows).filter(Boolean).length)} icon="🔄" color="#f3e5f5" />
      </div>

      {showNewRule && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title="New Rule" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Rule Name"><input value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} /></Field>
            <Field label="Trigger"><input value={newRule.trigger} onChange={e => setNewRule({ ...newRule, trigger: e.target.value })} placeholder="order.placed" /></Field>
            <Field label="Conditions (JSON)"><textarea value={newRule.conditions} onChange={e => setNewRule({ ...newRule, conditions: e.target.value })} rows={3} style={{ width: 300, fontFamily: 'monospace', fontSize: 12 }} /></Field>
            <Field label="Actions (JSON)"><textarea value={newRule.actions} onChange={e => setNewRule({ ...newRule, actions: e.target.value })} rows={3} style={{ width: 300, fontFamily: 'monospace', fontSize: 12 }} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Btn variant="primary" onClick={createRule} disabled={!newRule.name}>Create Rule</Btn></div>
        </Card>
      )}

      <Card style={{ marginBottom: 20 }}>
        <SectionTitle title="Workflows"
          right={<Badge variant="success">{Object.values(workflows).filter(Boolean).length} active</Badge>}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {Object.entries(workflows).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: T.r3, background: T.ghost, border: `1px solid ${T.hairline}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{key.replace(/-/g, ' ')}</span>
              <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22 }}>
                <input type="checkbox" checked={val} onChange={() => toggleWorkflow(key)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, transition: '0.3s',
                  backgroundColor: val ? '#22c55e' : '#e2e8f0',
                }}>
                  <span style={{
                    position: 'absolute', content: '', height: 18, width: 18, borderRadius: '50%', left: val ? 20 : 2, top: 2,
                    backgroundColor: 'white', transition: '0.3s',
                  }} />
                </span>
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <SectionTitle title={`Automation Rules (${rules.length})`} />
        <DataTable headers={['ID', 'Name', 'Trigger', 'Active', 'Executions', 'Errors', 'Actions']}>
          {rules.map(r => (
            <Tr key={r.id}>
              <Td muted>{r.id}</Td>
              <Td bold>{r.name}</Td>
              <Td><code style={{ fontSize: 11 }}>{r.trigger}</code></Td>
              <Td><Badge variant={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'ON' : 'OFF'}</Badge></Td>
              <Td>{r.executionCount || 0}</Td>
              <Td><span style={{ color: (r.errorCount || 0) > 0 ? '#ef4444' : T.muted }}>{(r.errorCount || 0) > 0 ? r.errorCount : '—'}</span></Td>
              <Td><div style={{ display: 'flex', gap: 4 }}>
                <Btn variant="outline" size="small" onClick={() => toggleRule(r.id)}>{r.isActive ? 'Disable' : 'Enable'}</Btn>
                <Btn variant="outline" size="small" onClick={() => deleteRule(r.id)} style={{ color: '#ef4444' }}>🗑</Btn>
              </div></Td>
            </Tr>
          ))}
          {rules.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: T.muted }}>No rules created yet.</td></tr>}
        </DataTable>
      </Card>

      <Card>
        <SectionTitle title="Recent Execution Logs" />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {logs.map((log, i) => (
            <div key={log.id || i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.hairline}`, fontSize: 12 }}>
              <span style={{ color: T.muted, minWidth: 70 }}>{new Date(log.createdAt).toLocaleTimeString()}</span>
              <Badge variant={log.success ? 'success' : 'danger'}>{log.success ? 'OK' : 'FAIL'}</Badge>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.steel }}>{log.ruleName || log.ruleId}</span>
              <span style={{ color: log.error || T.steel }}>{log.error || log.result || '—'}</span>
            </div>
          ))}
          {logs.length === 0 && <p style={{ textAlign: 'center', color: T.muted, padding: 24 }}>No logs yet.</p>}
        </div>
      </Card>
    </div>
  );
}
