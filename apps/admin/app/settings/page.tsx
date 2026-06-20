'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Field, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast as toastFn } from '../../lib/toast-store';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/config', { headers: h }).then(r => r.json()).then(data => { setSettings(data?.config || data || {}); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const updateSetting = async (key: string, value: any) => {
    try {
      setSaving(key);
      const h2 = getAuthHeaders();
      const res = await fetch('/api/v1/admin/config', { method: 'PATCH', headers: h2, body: JSON.stringify({ [key]: value }) });
      if (!res.ok) throw new Error('Failed to update setting');
      setSettings((prev: any) => ({ ...prev, [key]: value }));
      setSaving(null);
      setToast(`Updated ${key}`);
      setTimeout(() => setToast(''), 2000);
    } catch (err: any) {
      setSaving(null);
      toastFn.error('Update failed', err.message || 'Failed to update setting');
    }
  };

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading settings...</div>;

  const configGroups = [
    { title: 'General', key: 'general', fields: [
      { label: 'Restaurant Name', key: 'restaurantName', type: 'text' },
      { label: 'Tagline', key: 'tagline', type: 'text' },
      { label: 'Default Prep Time (min)', key: 'defaultPrepTimeMin', type: 'number' },
    ]},
    { title: 'Operations', key: 'operations', fields: [
      { label: 'Auto-confirm Orders', key: 'autoConfirmOrders', type: 'boolean' },
      { label: 'Max Orders Per Slot', key: 'maxOrdersPerSlot', type: 'number' },
      { label: 'Slot Duration (min)', key: 'slotDurationMin', type: 'number' },
    ]},
    { title: 'Delivery', key: 'delivery', fields: [
      { label: 'Base Delivery Fee (₹)', key: 'baseDeliveryFee', type: 'number' },
      { label: 'Free Delivery Above (₹)', key: 'freeDeliveryAbove', type: 'number' },
      { label: 'Max Delivery Radius (km)', key: 'maxDeliveryRadius', type: 'number' },
    ]},
    { title: 'Payments', key: 'payments', fields: [
      { label: 'Payment Timeout (min)', key: 'paymentTimeoutMin', type: 'number' },
      { label: 'Auto-cancel Unpaid Orders', key: 'autoCancelUnpaid', type: 'boolean' },
    ]},
    { title: 'Notifications', key: 'notifications', fields: [
      { label: 'SMS Enabled', key: 'smsEnabled', type: 'boolean' },
      { label: 'Email Enabled', key: 'emailEnabled', type: 'boolean' },
      { label: 'Low Stock Alert Threshold', key: 'lowStockAlertThreshold', type: 'number' },
    ]},
  ];

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="⚙️" title="Settings"
        subtitle={toast ? <span style={{ color: T.success }}>{toast}</span> : 'Configure your kitchen'}
      />

      {configGroups.map(group => (
        <Card key={group.key} style={{ marginBottom: 20 }}>
          <SectionTitle title={group.title} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {group.fields.map(field => {
              const val = settings[field.key] ?? '';
              const isBool = field.type === 'boolean';
              return (
                <div key={field.key}>
                  <Field label={field.label}>
                    {isBool ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!val}
                          onChange={e => updateSetting(field.key, e.target.checked)}
                        />
                        <span style={{ fontSize: 13, color: T.steel }}>{val ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type={field.type} value={val as string | number} step={field.type === 'number' ? '0.01' : undefined}
                          onChange={e => setSettings({ ...settings, [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: T.r2, border: `1px solid ${T.hairline}`, fontSize: 13 }}
                        />
                        <Btn variant="outline" size="sm" onClick={() => updateSetting(field.key, field.type === 'number' ? parseFloat(String(settings[field.key])) || 0 : settings[field.key])}
                          disabled={saving === field.key}>
                          {saving === field.key ? '...' : 'Save'}
                        </Btn>
                      </div>
                    )}
                  </Field>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
