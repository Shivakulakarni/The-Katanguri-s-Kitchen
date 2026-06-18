'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Badge, Field, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { toast } from '../../lib/toast-store';

interface Modifier { id: number; dishId: number; name: string; type: string; options: { label: string; price: number }[]; isRequired: boolean; }
interface Dish { id: number; name: string; categoryId: number; }

export default function MenuModifiersPage() {
  const [modifiers, setModifiers] = useState<Record<string, Modifier[]>>({});
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMod, setNewMod] = useState({ name: '', type: 'single', options: [{ label: '', price: 0 }], isRequired: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = getAuthHeaders();
    Promise.all([
      fetch('/api/v1/menu', { headers: h }).then(r => r.ok ? r.json() : []),
      fetch('/api/v1/menu/dishes/modifiers', { headers: h }).then(r => r.ok ? r.json() : {}),
    ]).then(([menuData, modsData]) => {
      const allDishes: Dish[] = [];
      const cats = Array.isArray(menuData) ? menuData : [];
      for (const cat of cats) { for (const dish of cat.dishes || []) { allDishes.push({ id: dish.id, name: dish.name, categoryId: cat.id }); } }
      setDishes(allDishes);
      setModifiers(modsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const dishMods = selectedDishId ? modifiers[selectedDishId.toString()] || [] : [];
  const totalModifiers = Object.values(modifiers).flat().length;

  const addModifier = async () => {
    if (!selectedDishId || !newMod.name) return;
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/menu/dishes/${selectedDishId}/modifiers`, { method: 'POST', headers: h2, body: JSON.stringify(newMod) });
      if (!res.ok) throw new Error('Failed to add modifier');
      const updated = await fetch('/api/v1/menu/dishes/modifiers', { headers: h2 }).then(r => r.json());
      setModifiers(updated);
      setShowAddForm(false);
      setNewMod({ name: '', type: 'single', options: [{ label: '', price: 0 }], isRequired: false });
    } catch (err: any) { toast.error('Add failed', err.message || 'Failed to add modifier'); }
  };

  const deleteModifier = async (modId: number) => {
    if (!confirm('Delete this modifier?')) return;
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/menu/dishes/modifiers/${modId}`, { method: 'DELETE', headers: h2 });
      if (!res.ok) throw new Error('Failed to delete modifier');
      const updated = await fetch('/api/v1/menu/dishes/modifiers', { headers: h2 }).then(r => r.json());
      setModifiers(updated);
    } catch (err: any) { toast.error('Delete failed', err.message || 'Failed to delete modifier'); }
  };

  const addOption = () => setNewMod({ ...newMod, options: [...newMod.options, { label: '', price: 0 }] });
  const updateOption = (i: number, field: 'label' | 'price', value: string | number) => {
    const opts = [...newMod.options]; opts[i] = { ...opts[i], [field]: value }; setNewMod({ ...newMod, options: opts });
  };
  const removeOption = (i: number) => {
    if (newMod.options.length <= 1) return;
    setNewMod({ ...newMod, options: newMod.options.filter((_, idx) => idx !== i) });
  };

  const selectedDish = dishes.find(d => d.id === selectedDishId);

  if (loading) return <div style={{ padding: 24, color: T.muted }}>Loading modifiers...</div>;

  return (
    <div>
      <AdminStyles />
      <PageHeader icon="🧀" title="Menu Modifiers"
        subtitle={`${totalModifiers} modifiers across ${dishes.length} dishes`}
      />

      <Card style={{ marginBottom: 20 }}>
        <SectionTitle title="Select Dish" />
        <select value={selectedDishId || ''} onChange={e => setSelectedDishId(e.target.value ? Number(e.target.value) : null)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: T.r3, border: `1px solid ${T.hairline}`, fontSize: 14, background: T.ghost }}>
          <option value="">— Choose a dish —</option>
          {dishes.map(d => <option key={d.id} value={d.id}>{d.name} (ID: {d.id})</option>)}
        </select>
      </Card>

      {selectedDish && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title={`Modifiers for ${selectedDish.name}`}
            right={<Btn variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>{showAddForm ? '✕ Cancel' : '+ Add Modifier'}</Btn>}
          />
          {dishMods.length === 0 ? (
            <p style={{ color: T.muted, textAlign: 'center', padding: 20 }}>No modifiers for this dish.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dishMods.map((mod: Modifier) => (
                <div key={mod.id} style={{ padding: 14, borderRadius: T.r3, border: `1px solid ${T.hairline}`, background: T.ghost }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={mod.isRequired ? 'info' : 'muted'}>{mod.isRequired ? 'Required' : 'Optional'}</Badge>
                      <strong style={{ fontSize: 14 }}>{mod.name}</strong>
                      <Badge variant="muted">{mod.type === 'single' ? 'Single select' : 'Multi select'}</Badge>
                    </div>
                    <Btn variant="outline" size="sm" onClick={() => deleteModifier(mod.id)} style={{ color: '#ef4444' }}>🗑</Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {mod.options.map((opt, idx) => (
                      <span key={idx} style={{ padding: '4px 10px', borderRadius: T.r5, background: '#f1f5f9', fontSize: 12, border: `1px solid #e2e8f0` }}>
                        {opt.label} {opt.price > 0 ? `(+₹${opt.price})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddForm && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: T.r3, border: `1px solid ${T.hairline}` }}>
              <SectionTitle title="New Modifier" />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <Field label="Name"><input value={newMod.name} onChange={e => setNewMod({ ...newMod, name: e.target.value })} /></Field>
                <Field label="Type">
                  <select value={newMod.type} onChange={e => setNewMod({ ...newMod, type: e.target.value })}>
                    <option value="single">Single select</option>
                    <option value="multiple">Multi select</option>
                  </select>
                </Field>
                <Field label="Required">
                  <input type="checkbox" checked={newMod.isRequired} onChange={e => setNewMod({ ...newMod, isRequired: e.target.checked })} />
                </Field>
              </div>
              <SectionTitle title="Options" right={<Btn variant="outline" size="sm" onClick={addOption}>+ Add Option</Btn>} />
              {newMod.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input placeholder="Label" value={opt.label} onChange={e => updateOption(i, 'label', e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: T.r2, border: `1px solid ${T.hairline}`, fontSize: 12 }} />
                  <input placeholder="Price" type="number" step="0.01" value={opt.price} onChange={e => updateOption(i, 'price', parseFloat(e.target.value) || 0)} style={{ width: 80, padding: '8px 12px', borderRadius: T.r2, border: `1px solid ${T.hairline}`, fontSize: 12 }} />
                  <button onClick={() => removeOption(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#991b1b', fontSize: 14 }}>✕</button>
                </div>
              ))}
              <div style={{ marginTop: 12 }}><Btn variant="primary" onClick={addModifier} disabled={!newMod.name}>Save Modifier</Btn></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
