'use client';

import { useEffect, useRef, useState } from 'react';

interface ActiveRider {
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

interface BatchTrackingViewProps {
  riders: ActiveRider[];
  kitchenLat?: number;
  kitchenLng?: number;
  height?: number;
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

// Leaflet loader
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

export default function BatchTrackingView({
  riders,
  kitchenLat = DEFAULT_KITCHEN.lat,
  kitchenLng = DEFAULT_KITCHEN.lng,
  height = 500,
}: BatchTrackingViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [selectedRider, setSelectedRider] = useState<ActiveRider | null>(null);

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

      const kitchenIcon = L.icon({ iconUrl: createKitchenIcon(), iconSize: [40, 40], iconAnchor: [20, 20] });
      L.marker([kitchenLat, kitchenLng], { icon: kitchenIcon })
        .addTo(map)
        .bindPopup('<b>🍳 Kitchen</b><br/>The Katanguri\'s Kitchen');

      map.setView([kitchenLat, kitchenLng], 13);
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    }).catch(err => console.error('Failed to initialize map:', err));

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [kitchenLat, kitchenLng]);

  // Update markers when riders change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const map = mapInstanceRef.current;

    const currentIds = new Set(riders.map(r => `${r.orderId}-${r.riderId}`));

    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    let hasNewRider = false;
    for (const rider of riders) {
      const id = `${rider.orderId}-${rider.riderId}`;
      const latlng: [number, number] = [rider.lat, rider.lng];

      if (markersRef.current.has(id)) {
        const marker = markersRef.current.get(id);
        const oldLatLng = marker.getLatLng();
        const steps = 20;
        const latDiff = (latlng[0] - oldLatLng.lat) / steps;
        const lngDiff = (latlng[1] - oldLatLng.lng) / steps;
        let step = 0;
        const animate = () => {
          if (step >= steps) { marker.setLatLng(latlng); return; }
          step++;
          marker.setLatLng([oldLatLng.lat + latDiff * step, oldLatLng.lng + lngDiff * step]);
          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        const newIcon = L.icon({ iconUrl: createRiderIcon(rider.heading || 0), iconSize: [40, 40], iconAnchor: [20, 20] });
        marker.setIcon(newIcon);
        marker.setPopupContent(
          `<b>🛵 ${escapeHtml(rider.riderName)}</b><br/>Order #${rider.orderId}<br/>` +
          `${rider.speed ? `${Math.round(rider.speed)} km/h ` : ''}` +
          `${rider.eta ? `ETA: ${rider.eta} min` : ''}`
        );
      } else {
        hasNewRider = true;
        const icon = L.icon({ iconUrl: createRiderIcon(rider.heading || 0), iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = L.marker(latlng, { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(
            `<b>🛵 ${escapeHtml(rider.riderName)}</b><br/>Order #${rider.orderId}<br/>` +
            `${rider.speed ? `${Math.round(rider.speed)} km/h ` : ''}` +
            `${rider.eta ? `ETA: ${rider.eta} min` : ''}`
          );
        marker.on('click', () => setSelectedRider(rider));
        markersRef.current.set(id, marker);
      }
    }

    if (hasNewRider) {
      const allPoints: [number, number][] = [[kitchenLat, kitchenLng]];
      for (const r of riders) allPoints.push([r.lat, r.lng]);
      if (allPoints.length > 1) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [riders, mapReady, kitchenLat, kitchenLng]);

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height }} />

      {/* Rider summary overlay */}
      {riders.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
          borderRadius: 12, padding: '10px 14px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          zIndex: 1000,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🛵</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1c' }}>
                {riders.length} Active Rider{riders.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#666' }}>
              <span>Avg ETA: {Math.round(riders.reduce((sum, r) => sum + (r.eta || 0), 0) / riders.length)} min</span>
              <span>Avg Speed: {Math.round(riders.reduce((sum, r) => sum + (r.speed || 0), 0) / riders.length)} km/h</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected rider details */}
      {selectedRider && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
          borderRadius: 12, padding: '12px 16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          zIndex: 1000, minWidth: 200,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🛵 {selectedRider.riderName}</span>
            <button
              onClick={() => setSelectedRider(null)}
              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#666' }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            <div>Order #{selectedRider.orderId}</div>
            {selectedRider.speed != null && <div>Speed: {Math.round(selectedRider.speed)} km/h</div>}
            {selectedRider.eta != null && <div>ETA: {selectedRider.eta} min</div>}
            {selectedRider.riderPhone && <div>Phone: {selectedRider.riderPhone}</div>}
            <div>Last update: {new Date(selectedRider.updatedAt).toLocaleTimeString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
