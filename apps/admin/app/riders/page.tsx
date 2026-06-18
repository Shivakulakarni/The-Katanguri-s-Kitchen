'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuthHeaders } from '../../lib/auth-headers';
import { PageHeader, Card, Badge, Btn } from '../ui';
import { MapPin, Smartphone } from 'lucide-react';

interface RiderLocation {
  orderId: number;
  riderId: string;
  riderName: string;
  riderPhone?: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  eta?: number;
  updatedAt: string;
}

const DEFAULT_KITCHEN = { lat: 17.9784, lng: 79.5941 };

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function createRiderIcon(heading: number = 0): string {
  const rotation = heading ? ` transform="rotate(${heading} 20 20)"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <g${rotation}>
      <circle cx="20" cy="20" r="18" fill="#e23744" stroke="#fff" stroke-width="3"/>
    </g>
    <text x="20" y="26" text-anchor="middle" font-size="20" fill="white">🛵</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function createKitchenIcon(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="#ff9800" stroke="#fff" stroke-width="3"/>
    <text x="20" y="26" text-anchor="middle" font-size="20" fill="white">🍳</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Leaflet loader with promise cache
let leafletLoadingPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).L) {
    return Promise.resolve();
  }
  if (leafletLoadingPromise) return leafletLoadingPromise;

  leafletLoadingPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    if ((window as any).L) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.onload = () => resolve();
    script.onerror = () => {
      leafletLoadingPromise = null;
      reject(new Error('Failed to load Leaflet'));
    };
    document.head.appendChild(script);
  });

  return leafletLoadingPromise;
}

function RiderMap({ riders }: { riders: RiderLocation[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const L = (window as any).L;

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Kitchen marker
      const kitchenIcon = L.icon({ iconUrl: createKitchenIcon(), iconSize: [40, 40], iconAnchor: [20, 20] });
      L.marker([DEFAULT_KITCHEN.lat, DEFAULT_KITCHEN.lng], { icon: kitchenIcon })
        .addTo(map)
        .bindPopup('<b>🍳 Kitchen</b><br/>The Katanguri\'s Kitchen');

      map.setView([DEFAULT_KITCHEN.lat, DEFAULT_KITCHEN.lng], 14);
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when riders change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const map = mapInstanceRef.current;

    const currentIds = new Set(riders.map(r => `${r.orderId}-${r.riderId}`));

    // Remove markers for riders no longer active
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    // Add or update rider markers
    for (const rider of riders) {
      const id = `${rider.orderId}-${rider.riderId}`;
      const latlng: [number, number] = [rider.lat, rider.lng];

      if (markersRef.current.has(id)) {
        // Smooth animation
        const marker = markersRef.current.get(id);
        const oldLatLng = marker.getLatLng();
        const steps = 20;
        const latDiff = (latlng[0] - oldLatLng.lat) / steps;
        const lngDiff = (latlng[1] - oldLatLng.lng) / steps;
        let step = 0;
        const animate = () => {
          if (step >= steps) {
            marker.setLatLng(latlng);
            return;
          }
          step++;
          marker.setLatLng([oldLatLng.lat + latDiff * step, oldLatLng.lng + lngDiff * step]);
          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        // Update icon if heading changed
        const newIcon = L.icon({ iconUrl: createRiderIcon(rider.heading || 0), iconSize: [40, 40], iconAnchor: [20, 20] });
        marker.setIcon(newIcon);
        marker.setPopupContent(
          `<b>🛵 ${escapeHtml(rider.riderName)}</b><br/>` +
          `Order #${rider.orderId}<br/>` +
          `${rider.speed ? `${Math.round(rider.speed)} km/h` : ''}` +
          `${rider.eta ? ` · ETA: ${rider.eta} min` : ''}` +
          `<br/><small>Updated: ${new Date(rider.updatedAt).toLocaleTimeString()}</small>`
        );
      } else {
        // Create new marker
        const icon = L.icon({ iconUrl: createRiderIcon(rider.heading || 0), iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = L.marker(latlng, { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(
            `<b>🛵 ${escapeHtml(rider.riderName)}</b><br/>` +
            `Order #${rider.orderId}<br/>` +
            `${rider.speed ? `${Math.round(rider.speed)} km/h` : ''}` +
            `${rider.eta ? ` · ETA: ${rider.eta} min` : ''}`
          );
        markersRef.current.set(id, marker);
      }
    }

    // Fit bounds to show all riders + kitchen
    const allPoints: [number, number][] = [[DEFAULT_KITCHEN.lat, DEFAULT_KITCHEN.lng]];
    for (const r of riders) allPoints.push([r.lat, r.lng]);
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50], maxZoom: 15 });
    }
  }, [riders, mapReady]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 500 }} />;
}

export default function RidersPage() {
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulations, setSimulations] = useState<Array<{ orderId: number; startedAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const fetchRiders = useCallback(async () => {
    const h = getAuthHeaders();
    try {
      const [locRes, simRes] = await Promise.all([
        fetch('/api/v1/admin/riders/locations', { headers: h }),
        fetch('/api/v1/admin/riders/simulations', { headers: h }),
      ]);
      if (locRes.ok) {
        const data = await locRes.json();
        setRiders(data.locations || []);
      }
      if (simRes.ok) {
        const data = await simRes.json();
        setSimulations(data.simulations || []);
      }
      setLoading(false);
    } catch {
      setError('Failed to fetch rider data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiders();
    const interval = setInterval(fetchRiders, 3000);
    return () => clearInterval(interval);
  }, [fetchRiders]);



  const stopSimulation = async (orderId: number) => {
    try {
      const h = getAuthHeaders();
      await fetch(`/api/v1/admin/riders/${orderId}/stop`, { method: 'POST', headers: h });
      setTimeout(fetchRiders, 500);
    } catch { /* ignore */ }
  };

  const simulateAll = async () => {
    try {
      const h = getAuthHeaders();
      await fetch('/api/v1/admin/riders/simulate-all', { method: 'POST', headers: h });
      setTimeout(fetchRiders, 2000);
    } catch { /* ignore */ }
  };

  if (loading) return <div style={{ padding: 24, color: '#94a3b8' }}>Loading rider map...</div>;

  return (
    <div style={{ padding: '4px 0' }}>
      <PageHeader
        icon="🗺️" title="Live Rider Map"
        subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Real-time tracking of all delivery riders
          <Badge variant={riders.length > 0 ? 'success' : 'warning'} pulse>
            {riders.length > 0 ? `${riders.length} Active` : 'No Riders'}
          </Badge>
        </span>}
        right={<>
          <Btn variant="outline" onClick={fetchRiders}>🔃 Refresh</Btn>
          <Btn variant="primary" onClick={simulateAll}>▶️ Simulate All</Btn>
        </>}
      />

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, height: 'calc(100vh - 160px)' }}>
        {/* Map */}
        <Card padding={0} style={{ overflow: 'hidden', borderRadius: 16 }}>
          <RiderMap riders={riders} />
        </Card>

        {/* Sidebar — Rider list & controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {/* Stats */}
          <Card padding={16}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#166534' }}>{riders.length}</div>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Active Riders</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: '#dbeafe', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e40af' }}>{simulations.length}</div>
                <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Simulations</div>
              </div>
            </div>
          </Card>

          {/* Rider Cards */}
          {riders.length > 0 ? (
            riders.map(rider => (
              <Card key={`${rider.orderId}-${rider.riderId}`} padding={14}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#e23744', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                    }}>🛵</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{rider.riderName}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Order #{rider.orderId}</div>
                    </div>
                  </div>
                  {rider.eta != null && rider.eta > 0 && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: '#fef3c7', color: '#92400e',
                    }}>
                      {rider.eta} min
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
                  {rider.speed != null && <span>⚡ {Math.round(rider.speed)} km/h</span>}
                  <span><MapPin size={14} /> {rider.lat.toFixed(4)}, {rider.lng.toFixed(4)}</span>
                  {rider.riderPhone && <span><Smartphone size={14} /> {rider.riderPhone}</span>}
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                  Last update: {new Date(rider.updatedAt).toLocaleTimeString()}
                </div>
              </Card>
            ))
          ) : (
            <Card padding={24}>
              <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛵</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No active riders</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Assign riders to orders or start a simulation</div>
                <button
                  onClick={simulateAll}
                  style={{
                    marginTop: 12, padding: '8px 20px', fontSize: 13, fontWeight: 700,
                    color: '#fff', background: '#e23744', border: 'none', borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  ▶️ Start Demo Simulation
                </button>
              </div>
            </Card>
          )}

          {/* Simulation Controls */}
          {simulations.length > 0 && (
            <Card padding={14}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
                🎮 Active Simulations
              </div>
              {simulations.map(sim => (
                <div key={sim.orderId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: '1px solid #f1f5f9',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Order #{sim.orderId}</span>
                  <button
                    onClick={() => stopSimulation(sim.orderId)}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5',
                      borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    Stop
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
