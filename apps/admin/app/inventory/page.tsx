'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Badge, DataTable, Tr, Td, Field, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast } from '../../lib/toast-store';

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '', unit: 'kg', stock: 0, minStock: 10, costPerUnit: 0 });

  useEffect(() => {
    const h = getAuthHeaders();
    Promise.all([
      fetch('/api/v1/admin/inventory', { headers: h }).then(r => r.json()),
      fetch('/api/v1/admin/inventory/transactions?limit=10', { headers: h }).then(r => r.json()),
    ]).then(([invData, txData]) => {
      setIngredients(invData.ingredients || []);
      setTransactions(txData.transactions || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const addIngredient = async () => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch('/api/v1/admin/inventory', { method: 'POST', headers: h2, body: JSON.stringify(newItem) });
      if (!res.ok) throw new Error('Failed to add ingredient');
      setShowForm(false);
      setNewItem({ name: '', category: '', unit: 'kg', stock: 0, minStock: 10, costPerUnit: 0 });
      const data = await fetch('/api/v1/admin/inventory', { headers: h2 }).then(r => r.json());
      setIngredients(data.ingredients || []);
    } catch (err: any) { toast.error('Add failed', err.message || 'Failed to add ingredient'); }
  };

  const updateStock = async (id: number, delta: number) => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/inventory/${id}/stock`, { method: 'PATCH', headers: h2, body: JSON.stringify({ delta }) });
      if (!res.ok) throw new Error('Failed to update stock');
      const data = await fetch('/api/v1/admin/inventory', { headers: h2 }).then(r => r.json());
      setIngredients(data.ingredients || []);
      const txData = await fetch('/api/v1/admin/inventory/transactions?limit=10', { headers: h2 }).then(r => r.json());
      setTransactions(txData.transactions || []);
    } catch (err: any) { toast.error('Update failed', err.message || 'Failed to update stock'); }
  };

  const lowStockItems = ingredients.filter((i: any) => i.stock <= i.minStock);
  const displayItems = lowStockOnly ? lowStockItems : ingredients;
  const totalValue = ingredients.reduce((sum: number, i: any) => sum + (i.stock * i.costPerUnit), 0);

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading inventory...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader title="Inventory"
        subtitle={`${ingredients.length} ingredients · ${lowStockItems.length} low stock`}
        right={<Btn variant="primary" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Cancel' : '+ Add Ingredient'}</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <Card><SectionTitle title={`Total Items: ${ingredients.length}`} /></Card>
        <Card><SectionTitle title={`Low Stock: ${lowStockItems.length}`} right={<Badge variant={lowStockItems.length > 0 ? 'danger' : 'success'}>{lowStockItems.length > 0 ? '⚠' : '✓'}</Badge>} /></Card>
        <Card><SectionTitle title={`Inventory Value: ₹${totalValue.toLocaleString()}`} /></Card>
        <Card><SectionTitle title={`Categories: ${new Set(ingredients.map((i: any) => i.category)).size}`} /></Card>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title="New Ingredient" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Name"><input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} /></Field>
            <Field label="Category"><input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="e.g. Vegetables" /></Field>
            <Field label="Unit">
              <select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="mL">mL</option>
                <option value="pcs">pcs</option>
                <option value="dozen">dozen</option>
              </select>
            </Field>
            <Field label="Stock"><input type="number" value={newItem.stock} onChange={e => setNewItem({ ...newItem, stock: +e.target.value })} style={{ width: 80 }} /></Field>
            <Field label="Min Stock"><input type="number" value={newItem.minStock} onChange={e => setNewItem({ ...newItem, minStock: +e.target.value })} style={{ width: 80 }} /></Field>
            <Field label="Cost/Unit (₹)"><input type="number" step="0.01" value={newItem.costPerUnit} onChange={e => setNewItem({ ...newItem, costPerUnit: +e.target.value })} style={{ width: 100 }} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Btn variant="primary" onClick={addIngredient} disabled={!newItem.name}>Add</Btn></div>
        </Card>
      )}

      <Card padding={0} style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.hairline}` }}>
          <SectionTitle title={`Ingredients (${displayItems.length})`} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={lowStockOnly} onChange={() => setLowStockOnly(!lowStockOnly)} />
            Low stock only ({lowStockItems.length})
          </label>
        </div>
        <DataTable headers={['Name', 'Category', 'Stock', 'Min', 'Unit', 'Cost/Unit', 'Status', 'Actions']}>
          {displayItems.map((item: any) => {
            const isLow = item.stock <= item.minStock;
            return (
              <Tr key={item.id} style={isLow ? { background: 'rgba(255,71,87,0.04)' } : {}}>
                <Td bold>{item.name}</Td>
                <Td style={{ color: T.steel }}>{item.category}</Td>
                <Td><span style={{ fontWeight: 700, color: isLow ? '#ef4444' : T.ink }}>{item.stock}</span></Td>
                <Td style={{ color: T.muted }}>{item.minStock}</Td>
                <Td style={{ fontSize: 12, color: T.steel }}>{item.unit}</Td>
                <Td>₹{item.costPerUnit?.toFixed(2)}</Td>
                <Td><Badge variant={isLow ? 'danger' : 'success'}>{isLow ? 'Low Stock' : 'OK'}</Badge></Td>
                <Td><div style={{ display: 'flex', gap: 4 }}>
                  <Btn variant="outline" size="small" onClick={() => updateStock(item.id, 1)}>+1</Btn>
                  <Btn variant="outline" size="small" onClick={() => updateStock(item.id, -1)} disabled={item.stock <= 0}>-1</Btn>
                </div></Td>
              </Tr>
            );
          })}
          {displayItems.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: T.muted }}>No ingredients found.</td></tr>}
        </DataTable>
      </Card>

      <Card>
        <SectionTitle title="Recent Stock Transactions" />
        <div style={{ maxHeight: 250, overflowY: 'auto' }}>
          {transactions.map((tx: any) => (
            <div key={tx.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.hairline}`, fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: T.muted, minWidth: 70 }}>{new Date(tx.createdAt).toLocaleTimeString()}</span>
              <Badge variant={tx.delta > 0 ? 'success' : 'danger'}>{tx.delta > 0 ? `+${tx.delta}` : tx.delta}</Badge>
              <span style={{ fontWeight: 600 }}>{tx.ingredientName || `Ingredient #${tx.ingredientId}`}</span>
              <span style={{ color: T.steel }}>{tx.note || '—'}</span>
            </div>
          ))}
          {transactions.length === 0 && <p style={{ textAlign: 'center', color: T.muted, padding: 20 }}>No transactions yet.</p>}
        </div>
      </Card>
    </div>
  );
}
