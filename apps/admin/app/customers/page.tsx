'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Badge, DataTable, Tr, Td, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/customers', { headers: h }).then(r => r.json())
      .then(data => { setCustomers(data.customers || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading customers...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="👥" title="Customers" subtitle={`${customers.length} registered customers`} />

      <Card padding={0}>
        <DataTable headers={['ID', 'Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Status']}>
          {customers.map(c => (
            <Tr key={c.id}>
              <Td muted style={{ fontFamily: 'monospace' }}>{c.id}</Td>
              <Td bold>{c.name || '—'}</Td>
              <Td>{c.email || '—'}</Td>
              <Td>{c.phone || '—'}</Td>
              <Td>{c.orderCount || 0}</Td>
              <Td bold>₹{(c.totalSpent || 0).toLocaleString()}</Td>
              <Td><Badge variant={(c.orderCount || 0) > 5 ? 'success' : 'muted'}>{(c.orderCount || 0) > 5 ? 'Regular' : 'New'}</Badge></Td>
            </Tr>
          ))}
          {customers.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: T.muted }}>No customers found.</td></tr>}
        </DataTable>
      </Card>
    </div>
  );
}
