'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, Btn, Badge, Field, AdminStyles, T } from '../ui';

interface Photo { id: string; url: string; alt: string; category: string; uploadedAt: string; }

const CATEGORIES = ['All', 'NON-VEG STARTERS', 'VEG STARTERS', 'NON-VEG CURRIES', 'VEG CURRIES', 'CHINESE', 'RICE BOWL COMBO', 'BIRYANIS', 'BREADS', 'DESSERTS'];

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [newPhoto, setNewPhoto] = useState({ url: '', alt: '', category: 'Gallery' });

  useEffect(() => {
    // Load custom photos from localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_photos') : null;
    if (saved) {
      try { setPhotos(JSON.parse(saved)); } catch { /* ignore */ }
    }

    const API = process.env.NEXT_PUBLIC_API_URL || '';
    Promise.all([
      fetch(`${API}/api/v1/menu/dishes`).then(r => r.json()),
      fetch(`${API}/api/v1/menu/categories`).then(r => r.json()),
    ]).then(([dishData, catData]) => {
      const dishes = dishData.dishes || dishData || [];
      const categories = Array.isArray(catData) ? catData : [];
      const catMap: Record<number, string> = {};
      categories.forEach((c: any) => { catMap[c.id] = c.name; });
      const mapped: Photo[] = dishes
        .filter((d: any) => d.imageUrl)
        .map((d: any, i: number) => ({
          id: String(d.id || i),
          url: d.imageUrl,
          alt: d.name,
          category: catMap[d.categoryId] || 'Gallery',
          uploadedAt: new Date(d.createdAt || Date.now()).toISOString().slice(0, 10),
        }));
      setPhotos(prev => {
        const custom = prev.filter(p => !mapped.some(m => m.id === p.id));
        const allPhotos = [...mapped, ...custom];
        localStorage.setItem('admin_photos', JSON.stringify(custom));
        return allPhotos;
      });
    }).catch(() => {});
  }, []);

  const filtered = activeCategory === 'All' ? photos : photos.filter(p => p.category === activeCategory);

  const addPhoto = () => {
    if (!newPhoto.url) return;
    const newP = { id: String(Date.now()), url: newPhoto.url, alt: newPhoto.alt, category: newPhoto.category, uploadedAt: new Date().toISOString().slice(0, 10) };
    setPhotos(prev => {
      const updated = [...prev, newP];
      const custom = updated.filter(p => !p.id.match(/^\d+$/));
      localStorage.setItem('admin_photos', JSON.stringify(custom));
      return updated;
    });
    setNewPhoto({ url: '', alt: '', category: 'Gallery' });
    setShowUpload(false);
  };

  const deletePhoto = (id: string) => {
    if (!confirm('Remove this photo?')) return;
    setPhotos(prev => {
      const updated = prev.filter(p => p.id !== id);
      const custom = updated.filter(p => !p.id.match(/^\d+$/));
      localStorage.setItem('admin_photos', JSON.stringify(custom));
      return updated;
    });
  };

  return (
    <div>
      <AdminStyles />
      <PageHeader
        icon="📸" title="Photos & Media"
        subtitle={`${photos.length} photos · Manage your food photography`}
        right={<Btn variant="primary" onClick={() => setShowUpload(!showUpload)}>{showUpload ? 'Cancel' : '+ Add Photo'}</Btn>}
      />

      {showUpload && (
        <Card style={{ marginBottom: 20, animation: 'uiSlideDown 0.25s ease' }}>
          <SectionTitle title="Add New Photo" />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Image URL" value={newPhoto.url} onChange={v => setNewPhoto(p => ({ ...p, url: v }))} placeholder="https://images.unsplash.com/..." />
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.steel, marginBottom: 5, display: 'block' }}>Category</label>
              <select value={newPhoto.category} onChange={e => setNewPhoto(p => ({ ...p, category: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${T.hairline}`, borderRadius: T.r2, fontSize: 14, cursor: 'pointer' }}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Field label="Alt Text / Description" value={newPhoto.alt} onChange={v => setNewPhoto(p => ({ ...p, alt: v }))} placeholder="e.g. Nizami Chicken Dum Biryani" />
          {newPhoto.url && (
            <div style={{ marginTop: 12, borderRadius: T.r3, overflow: 'hidden', maxHeight: 200 }}>
              <img src={newPhoto.url} alt="Preview" style={{ width: '100%', height: 200, objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Btn variant="primary" onClick={addPhoto} disabled={!newPhoto.url}>Upload Photo</Btn>
          </div>
        </Card>
      )}

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding: '7px 16px', borderRadius: T.r5, border: 'none',
            background: activeCategory === cat ? T.ink : T.ghost,
            color: activeCategory === cat ? T.white : T.steel,
            cursor: 'pointer', fontWeight: activeCategory === cat ? 700 : 500, fontSize: 13,
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}>{cat}</button>
        ))}
      </div>

      {/* Photo Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {filtered.map(photo => (
          <div key={photo.id} style={{ background: T.white, borderRadius: T.r3, overflow: 'hidden', border: `1px solid ${T.hairline}`, position: 'relative' }}>
            <div style={{ height: 180, overflow: 'hidden' }}>
              <img src={photo.url} alt={photo.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.currentTarget.style.background = T.ghost; e.currentTarget.alt = 'Image failed to load'; }} />
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: T.ink }}>{photo.alt || 'Untitled'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge variant="muted">{photo.category}</Badge>
                <Btn variant="danger" onClick={() => deletePhoto(photo.id)} style={{ fontSize: 11, padding: '4px 10px' }}>Remove</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <p>No photos in this category. Add some!</p>
        </div>
      )}
    </div>
  );
}
