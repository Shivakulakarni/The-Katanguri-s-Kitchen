'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Badge, DataTable, Tr, Td, Field, AdminStyles, T } from '../ui';
import { ImageUpload } from '../components/ImageUpload';
import { getAuthHeaders } from '../../lib/auth-headers';

interface Dish {
  id: number; name: string; description: string; price: string;
  prepTimeMin: number; isVeg: boolean; isAvailable: boolean; categoryId: number;
}
interface Category {
  id: number; name: string; description: string; displayOrder: number; isActive: boolean; dishes: Dish[];
}

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashDishId, setFlashDishId] = useState<number | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showDishForm, setShowDishForm] = useState<number | null>(null);
  const [editDishId, setEditDishId] = useState<number | null>(null);
  const [newCat, setNewCat] = useState({ name: '', description: '', displayOrder: 0 });
  const [newDish, setNewDish] = useState({ name: '', description: '', price: '', prepTimeMin: 15, isVeg: true, imageUrl: '' });
  const [editDish, setEditDish] = useState({ name: '', description: '', price: '', prepTimeMin: 15, isVeg: true, imageUrl: '', isAvailable: true });
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchMenu = () => {
    fetch('/api/v1/menu').then(r => r.json()).then((data) => { setCategories(Array.isArray(data) ? data : []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMenu();
    const es = new EventSource('/api/v1/admin/orders/stream', { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.event === 'menu_update' && evt.payload) {
          const { dishId, isAvailable } = evt.payload;
          setCategories(prev => prev.map(cat => ({ ...cat, dishes: cat.dishes.map(d => d.id === dishId ? { ...d, isAvailable } : d) })));
        }
      } catch {
        // ignore JSON parse/menu update errors
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, []);

  const addCategory = async () => {
    const h = getAuthHeaders();
    try {
      const res = await fetch('/api/v1/admin/menu/categories', { method: 'POST', headers: h, body: JSON.stringify(newCat) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to create category'); }
      setShowCategoryForm(false); setNewCat({ name: '', description: '', displayOrder: 0 }); fetchMenu();
    } catch (err: any) { showToast(err.message || 'Failed to create category'); }
  };

  const toggleCategory = async (cat: Category) => {
    const h = getAuthHeaders();
    try {
      const res = await fetch(`/api/v1/admin/menu/categories/${cat.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ isActive: !cat.isActive }) });
      if (!res.ok) throw new Error('Failed to toggle category');
      fetchMenu();
    } catch (err: any) { showToast(err.message || 'Failed to toggle category'); }
  };

  const addDish = async (catId: number) => {
    const h = getAuthHeaders();
    try {
      const res = await fetch(`/api/v1/admin/menu/dishes`, { method: 'POST', headers: h, body: JSON.stringify({ ...newDish, categoryId: catId }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to create dish'); }
      setShowDishForm(null); setNewDish({ name: '', description: '', price: '', prepTimeMin: 15, isVeg: true, imageUrl: '' }); fetchMenu();
    } catch (err: any) { showToast(err.message || 'Failed to create dish'); }
  };

  const toggleDish = async (dish: Dish) => {
    const h = getAuthHeaders();
    setFlashDishId(dish.id); setTimeout(() => setFlashDishId(null), 1200);
    try {
      const res = await fetch(`/api/v1/admin/menu/dishes/${dish.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ isAvailable: !dish.isAvailable }) });
      if (!res.ok) throw new Error('Failed to toggle dish');
      fetchMenu();
    } catch (err: any) { showToast(err.message || 'Failed to toggle dish'); }
  };

  const deleteDish = async (dishId: number) => {
    if (!confirm('Delete this dish?')) return;
    const h = getAuthHeaders();
    try {
      const res = await fetch(`/api/v1/admin/menu/dishes/${dishId}`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error('Failed to delete dish');
      fetchMenu();
    } catch (err: any) { showToast(err.message || 'Failed to delete dish'); }
  };

  const startEditDish = (dish: Dish) => {
    setEditDishId(dish.id);
    setEditDish({ name: dish.name, description: dish.description, price: dish.price, prepTimeMin: dish.prepTimeMin, isVeg: dish.isVeg, imageUrl: '', isAvailable: dish.isAvailable });
  };

  const saveEditDish = async (dishId: number) => {
    try {
      const h = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/menu/dishes/${dishId}`, { method: 'PATCH', headers: h, body: JSON.stringify({ name: editDish.name, description: editDish.description, price: parseFloat(editDish.price), prepTimeMin: editDish.prepTimeMin, isVeg: editDish.isVeg, imageUrl: editDish.imageUrl || undefined, isAvailable: editDish.isAvailable }) });
      if (!res.ok) throw new Error('Failed to save dish');
      setEditDishId(null);
      fetchMenu();
    } catch (err: any) { showToast(err.message || 'Failed to save dish'); }
  };

  const filteredCategories = categories.map(c => ({
    ...c,
    dishes: c.dishes.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase())),
  })).filter(c => c.dishes.length > 0 || !search);

  return (
    <div>
      <AdminStyles />
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: toastMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: toastMsg.type === 'error' ? '#991b1b' : '#166534',
          border: `1px solid ${toastMsg.type === 'error' ? '#fca5a5' : '#86efac'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toastMsg.type === 'error' ? '✕' : '✓'} {toastMsg.msg}
        </div>
      )}
      <PageHeader icon="🍔" title="Menu Management" subtitle={`${categories.length} categories`}
        right={<Btn variant="primary" onClick={() => setShowCategoryForm(!showCategoryForm)}>{showCategoryForm ? '✕ Cancel' : '+ New Category'}</Btn>}
      />

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search dishes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 16px', borderRadius: T.r3, border: `1px solid ${T.hairline}`, background: T.ghost, fontSize: 14, color: T.ink, outline: 'none' }}
        />
      </div>

      {showCategoryForm && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle title="New Category" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Name"><input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} /></Field>
            <Field label="Description"><input value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} /></Field>
            <Field label="Order"><input type="number" value={newCat.displayOrder} onChange={e => setNewCat({ ...newCat, displayOrder: +e.target.value })} style={{ width: 80 }} /></Field>
            <Btn variant="primary" onClick={addCategory} disabled={!newCat.name}>Create</Btn>
          </div>
        </Card>
      )}

      {loading ? <p style={{ color: T.muted }}>Loading menu...</p> : filteredCategories.map(cat => (
        <Card key={cat.id} style={{ marginBottom: 20 }}>
          <SectionTitle title={`${cat.name}${cat.description ? ` — ${cat.description}` : ''}`}
            right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn variant={cat.isActive ? 'outline' : 'primary'} size="sm" onClick={() => toggleCategory(cat)}>{cat.isActive ? 'Deactivate' : 'Activate'}</Btn>
              <Btn variant="primary" size="sm" onClick={() => setShowDishForm(cat.id)}>+ Dish</Btn>
            </div>}
          />
          <DataTable headers={['#', 'Name', 'Price', 'Prep', 'Veg', 'Status', 'Actions']}>
            {cat.dishes.map(d => (
              <Tr key={d.id} style={flashDishId === d.id ? { background: 'rgba(76,175,80,0.08)', transition: 'background 0.3s' } : {}}>
                <Td muted>{d.id}</Td>
                <Td bold>{d.name}</Td>
                <Td bold>₹{parseFloat(d.price).toLocaleString()}</Td>
                <Td>{d.prepTimeMin}min</Td>
                <Td>{d.isVeg ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>V</span> : <span style={{ color: '#d32f2f', fontWeight: 700 }}>NV</span>}</Td>
                <Td><Badge variant={d.isAvailable ? 'success' : 'muted'}>{d.isAvailable ? 'Available' : 'Hidden'}</Badge></Td>
                <Td><div style={{ display: 'flex', gap: 4 }}>
                  <Btn variant="outline" size="sm" onClick={() => startEditDish(d)}>✏️</Btn>
                  <Btn variant="outline" size="sm" onClick={() => toggleDish(d)}>{d.isAvailable ? 'Hide' : 'Show'}</Btn>
                  <Btn variant="outline" size="sm" onClick={() => deleteDish(d.id)} style={{ color: '#ef4444' }}>🗑</Btn>
                </div></Td>
              </Tr>
            ))}
          </DataTable>

          {editDishId !== null && cat.dishes.some(d => d.id === editDishId) && (
            <div style={{ marginTop: 16, padding: 16, background: '#f0f9ff', borderRadius: T.r3, border: '1px solid #bae6fd' }}>
              <SectionTitle title={`Edit: ${cat.dishes.find(d => d.id === editDishId)?.name}`} />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Name"><input value={editDish.name} onChange={e => setEditDish({ ...editDish, name: e.target.value })} /></Field>
                <Field label="Description"><input value={editDish.description} onChange={e => setEditDish({ ...editDish, description: e.target.value })} /></Field>
                <Field label="Price (₹)"><input type="number" step="0.01" value={editDish.price} onChange={e => setEditDish({ ...editDish, price: e.target.value })} style={{ width: 100 }} /></Field>
                <Field label="Prep (min)"><input type="number" value={editDish.prepTimeMin} onChange={e => setEditDish({ ...editDish, prepTimeMin: +e.target.value })} style={{ width: 80 }} /></Field>
                <Field label="Is Veg"><input type="checkbox" checked={editDish.isVeg} onChange={e => setEditDish({ ...editDish, isVeg: e.target.checked })} /></Field>
                <Field label="Image URL"><ImageUpload onUploaded={(url: string) => setEditDish({ ...editDish, imageUrl: url })} /></Field>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Btn variant="primary" onClick={() => saveEditDish(editDishId!)} disabled={!editDish.name || !editDish.price}>Save Changes</Btn>
                <Btn variant="outline" onClick={() => setEditDishId(null)}>Cancel</Btn>
              </div>
            </div>
          )}

          {showDishForm === cat.id && (
            <div style={{ marginTop: 16, padding: 16, background: T.ghost, borderRadius: T.r3, border: `1px solid ${T.hairline}` }}>
              <SectionTitle title="New Dish" />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Name"><input value={newDish.name} onChange={e => setNewDish({ ...newDish, name: e.target.value })} /></Field>
                <Field label="Description"><input value={newDish.description} onChange={e => setNewDish({ ...newDish, description: e.target.value })} /></Field>
                <Field label="Price (₹)"><input type="number" min="0.01" step="0.01" value={newDish.price} onChange={e => setNewDish({ ...newDish, price: e.target.value })} style={{ width: 100 }} /></Field>
                <Field label="Prep (min)"><input type="number" value={newDish.prepTimeMin} onChange={e => setNewDish({ ...newDish, prepTimeMin: +e.target.value })} style={{ width: 80 }} /></Field>
                <Field label="Is Veg">
                  <input type="checkbox" checked={newDish.isVeg} onChange={e => setNewDish({ ...newDish, isVeg: e.target.checked })} />
                </Field>
                <Field label="Image URL"><ImageUpload onUploaded={(url: string) => setNewDish({ ...newDish, imageUrl: url })} /></Field>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Btn variant="primary" onClick={() => addDish(cat.id)} disabled={!newDish.name || !newDish.price}>Create Dish</Btn>
                <Btn variant="outline" onClick={() => setShowDishForm(null)}>Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
