'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { getAuthHeaders } from '../../lib/auth-headers';
import { MapPin } from 'lucide-react';
import { toast } from '../../lib/toast-store';

interface DeliveryZone {
  id: number; name: string; description: string | null;
  centerLat: string; centerLng: string; radiusKm: string;
  deliveryFee: string; minimumOrder: string; estimatedMinutes: number | null;
  isActive: boolean; createdAt: string;
}

interface ZoneValidation {
  deliverable: boolean;
  zone?: { id: number; name: string; deliveryFee: number; minimumOrder: number; estimatedMinutes: number | null };
  distance?: number;
  error?: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function DeliveryMap({ zones }: { zones: DeliveryZone[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;

    const L = window.L;
    const map = L.map(mapRef.current).setView([17.9784, 79.5941], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;
    const L = window.L;

    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];
    zones.forEach(zone => {
      const circle = L.circle([parseFloat(zone.centerLat), parseFloat(zone.centerLng)], {
        radius: parseFloat(zone.radiusKm) * 1000,
        color: zone.isActive ? '#22c55e' : '#ef4444',
        fillColor: zone.isActive ? '#22c55e' : '#ef4444',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map).bindPopup(`<b>${escapeHtml(zone.name)}</b><br/>Fee: ₹${escapeHtml(zone.deliveryFee)}<br/>Min: ₹${escapeHtml(zone.minimumOrder)}`);
      layersRef.current.push(circle);
    });
  }, [zones]);

  return <div ref={mapRef} style={{ width: '100%', height: 400, borderRadius: 12, zIndex: 0 }} />;
}

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', description: '', centerLat: '17.9784', centerLng: '79.5941', radiusKm: '5', deliveryFee: '30', minimumOrder: '99', estimatedMinutes: 30 });
  const [validateLat, setValidateLat] = useState('17.9784');
  const [validateLng, setValidateLng] = useState('79.5941');
  const [validation, setValidation] = useState<ZoneValidation | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    const h = getAuthHeaders();
    fetch('/api/v1/admin/delivery/zones', { headers: h }).then(r => r.json())
      .then(data => { setZones(data.zones || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const addZone = async () => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch('/api/v1/admin/delivery/zones', {
        method: 'POST', headers: h2, body: JSON.stringify({ ...newZone, estimatedMinutes: newZone.estimatedMinutes || null }),
      });
      if (!res.ok) throw new Error('Failed to add zone');
      setShowForm(false);
      setNewZone({ name: '', description: '', centerLat: '17.9784', centerLng: '79.5941', radiusKm: '5', deliveryFee: '30', minimumOrder: '99', estimatedMinutes: 30 });
      const data = await fetch('/api/v1/admin/delivery/zones', { headers: h2 }).then(r => r.json());
      setZones(data.zones || []);
    } catch (err: any) { toast.error('Add failed', err.message || 'Failed to add zone'); }
  };

  const toggleZone = async (id: number) => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/delivery/zones/${id}/toggle`, { method: 'POST', headers: h2 });
      if (!res.ok) throw new Error('Failed to toggle zone');
      setZones(prev => prev.map(z => z.id === id ? { ...z, isActive: !z.isActive } : z));
    } catch (err: any) { toast.error('Toggle failed', err.message || 'Failed to toggle zone'); }
  };

  const deleteZone = async (id: number) => {
    if (!confirm('Delete this delivery zone?')) return;
    try {
      const h2 = getAuthHeaders();
      const res = await fetch(`/api/v1/admin/delivery/zones/${id}`, { method: 'DELETE', headers: h2 });
      if (!res.ok) throw new Error('Failed to delete zone');
      setZones(prev => prev.filter(z => z.id !== id));
    } catch (err: any) { toast.error('Delete failed', err.message || 'Failed to delete zone'); }
  };

  const validateLocation = async () => {
    try {
      const h2 = getAuthHeaders();
      const res = await fetch('/api/v1/admin/delivery/validate', {
        method: 'POST', headers: h2, body: JSON.stringify({ lat: validateLat, lng: validateLng }),
      });
      const data = await res.json();
      setValidation(data);
    } catch (err: any) { toast.error('Validation failed', err.message || 'Failed to validate location'); }
  };

  if (loading) return <div style={{ padding: 24, color: '#94a3b8' }}>Loading delivery zones...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        onLoad={() => setLeafletLoaded(true)} strategy="lazyOnload" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Delivery Zones</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>{zones.length} zones configured</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#ff4757', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          {showForm ? '✕ Cancel' : '+ Add Zone'}
        </button>
      </div>

      {leafletLoaded && <DeliveryMap zones={zones} />}

      {showForm && (
        <div style={{ marginTop: 20, padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>New Delivery Zone</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Name</label>
              <input value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Description</label>
              <input value={newZone.description} onChange={e => setNewZone({ ...newZone, description: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Center Lat</label>
              <input type="number" step="0.0001" value={newZone.centerLat} onChange={e => setNewZone({ ...newZone, centerLat: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Center Lng</label>
              <input type="number" step="0.0001" value={newZone.centerLng} onChange={e => setNewZone({ ...newZone, centerLng: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Radius (km)</label>
              <input type="number" step="0.1" value={newZone.radiusKm} onChange={e => setNewZone({ ...newZone, radiusKm: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Delivery Fee (₹)</label>
              <input type="number" step="0.01" value={newZone.deliveryFee} onChange={e => setNewZone({ ...newZone, deliveryFee: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Minimum Order (₹)</label>
              <input type="number" step="0.01" value={newZone.minimumOrder} onChange={e => setNewZone({ ...newZone, minimumOrder: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Est. Minutes</label>
              <input type="number" value={newZone.estimatedMinutes} onChange={e => setNewZone({ ...newZone, estimatedMinutes: +e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={addZone} disabled={!newZone.name}
              style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700, color: '#fff', background: newZone.name ? '#ff4757' : '#ccc', border: 'none', borderRadius: 8, cursor: newZone.name ? 'pointer' : 'not-allowed' }}>
              Create Zone
            </button>
          </div>
        </div>
      )}

      {/* Zone Validation Tool */}
      <div style={{ marginTop: 24, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>🔍 Validate Location</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Latitude</label>
            <input type="number" step="0.0001" value={validateLat} onChange={e => setValidateLat(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, width: 140 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#57606f', display: 'block', marginBottom: 4 }}>Longitude</label>
            <input type="number" step="0.0001" value={validateLng} onChange={e => setValidateLng(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, width: 140 }} />
          </div>
          <button onClick={validateLocation}
            style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#3b82f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Check
          </button>
        </div>
        {validation && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: validation.deliverable ? '#f0fdf4' : '#fef2f2', border: `1px solid ${validation.deliverable ? '#86efac' : '#fca5a5'}` }}>
            {validation.deliverable ? (
              <span>✅ Deliverable! Zone: <strong>{validation.zone?.name}</strong> ({(validation.distance || 0).toFixed(2)}km away, Fee: ₹{validation.zone?.deliveryFee})</span>
            ) : (
              <span>❌ {validation.error || 'Not deliverable'}</span>
            )}
          </div>
        )}
      </div>

      {/* Zones List */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {zones.map(zone => (
          <div key={zone.id} style={{ padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 15 }}>{zone.name}</strong>
                {zone.description && <span style={{ color: '#64748b', fontSize: 13, marginLeft: 8 }}>{zone.description}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: zone.isActive ? '#dcfce7' : '#f1f5f9', color: zone.isActive ? '#166534' : '#64748b' }}>
                  {zone.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => toggleZone(zone.id)}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#3b82f6', background: 'transparent', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                  {zone.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => deleteZone(zone.id)}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'transparent', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span><MapPin size={14} /> ({zone.centerLat}, {zone.centerLng})</span>
              <span>Radius: {zone.radiusKm}km</span>
              <span>Fee: ₹{zone.deliveryFee}</span>
              <span>Min: ₹{zone.minimumOrder}</span>
              {zone.estimatedMinutes && <span>⏱ {zone.estimatedMinutes}min</span>}
            </div>
          </div>
        ))}
        {zones.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No delivery zones configured yet.</div>
        )}
      </div>
    </div>
  );
}
