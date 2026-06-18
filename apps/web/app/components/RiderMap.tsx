'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const DirectionsOverlay = dynamic(() => import('./DirectionsOverlay'), { ssr: false });

export interface RiderPosition {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  eta?: number;
  riderName?: string;
  riderPhone?: string;
  updatedAt?: string;
}

interface RiderMapProps {
  riderPosition: RiderPosition | null;
  kitchenLat?: number;
  kitchenLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  height?: number;
}

/**
 * Load Leaflet CSS and JS on demand (only when this component is used).
 * Caches the loading promise to prevent duplicate script tags.
 */
let leafletLoadingPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).L) {
    return Promise.resolve();
  }
  if (leafletLoadingPromise) return leafletLoadingPromise;

  leafletLoadingPromise = new Promise((resolve, reject) => {
    // Load CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    // Load JS
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

// Kitchen location (Hanamkonda, Warangal — The Katanguri's Kitchen)
const DEFAULT_KITCHEN = { lat: 17.9784, lng: 79.5941 };

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Custom markers are implemented using L.divIcon with CSS transitions below

export default function RiderMap({
  riderPosition,
  kitchenLat = DEFAULT_KITCHEN.lat,
  kitchenLng = DEFAULT_KITCHEN.lng,
  deliveryLat,
  deliveryLng,
  height = 320,
}: RiderMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeLineBaseRef = useRef<any>(null);
  const routeLineTraveledRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const animationFrameIdRef = useRef<number | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const L = (window as any).L;

      // Calculate center and zoom based on available points
      const points: [number, number][] = [[kitchenLat, kitchenLng]];
      if (riderPosition) points.push([riderPosition.lat, riderPosition.lng]);
      if (deliveryLat && deliveryLng) points.push([deliveryLat, deliveryLng]);

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      // Swiggy/Zomato-style dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Kitchen marker (Swiggy style badge with ripple animation)
      const kitchenIcon = L.divIcon({
        html: `
          <div class="custom-marker kitchen-marker">
            <div class="marker-pulse-ring kitchen-pulse"></div>
            <div class="marker-badge kitchen-badge">
              <span class="marker-emoji">🍳</span>
            </div>
          </div>
        `,
        className: 'custom-leaflet-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      L.marker([kitchenLat, kitchenLng], { icon: kitchenIcon })
        .addTo(map)
        .bindPopup('<b>🍳 Kitchen</b><br/>The Katanguri\'s Kitchen');

      // Delivery destination marker (Zomato style badge with green ripple)
      if (deliveryLat && deliveryLng) {
        const destIcon = L.divIcon({
          html: `
            <div class="custom-marker destination-marker">
              <div class="marker-pulse-ring destination-pulse"></div>
              <div class="marker-badge destination-badge">
                <span class="marker-emoji">🏠</span>
              </div>
            </div>
          `,
          className: 'custom-leaflet-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        L.marker([deliveryLat, deliveryLng], { icon: destIcon })
          .addTo(map)
          .bindPopup('<b>🏠 Your Location</b>');
      }

      // Fit bounds to show all points
      if (points.length > 1) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else {
        map.setView([kitchenLat, kitchenLng], 14);
      }

      mapInstanceRef.current = map;
      setMapReady(true);

      // Invalidate size after a short delay (helps with Next.js layout shifts)
      setTimeout(() => map.invalidateSize(), 100);
    }).catch(() => { /* Leaflet load failed — map won't render */ });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [kitchenLat, kitchenLng, deliveryLat, deliveryLng]);

  // Update route lines (split traveled portion and glowing remaining portion)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;

    // Clean up old polylines
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (routeLineBaseRef.current) {
      map.removeLayer(routeLineBaseRef.current);
      routeLineBaseRef.current = null;
    }
    if (routeLineTraveledRef.current) {
      map.removeLayer(routeLineTraveledRef.current);
      routeLineTraveledRef.current = null;
    }

    if (riderPosition) {
      // 1. Traveled part: Kitchen to Rider (faded gray dashed route)
      const traveledPoints: [number, number][] = [[kitchenLat, kitchenLng], [riderPosition.lat, riderPosition.lng]];
      routeLineTraveledRef.current = L.polyline(traveledPoints, {
        color: '#7f8c8d',
        weight: 3.5,
        opacity: 0.6,
        dashArray: '6, 8',
      }).addTo(map);

      // 2. Remaining part: Rider to Customer (glowing crawling route)
      if (deliveryLat && deliveryLng) {
        const remainingPoints: [number, number][] = [[riderPosition.lat, riderPosition.lng], [deliveryLat, deliveryLng]];
        
        // Base thick glow
        routeLineBaseRef.current = L.polyline(remainingPoints, {
          color: '#fc8019',
          weight: 7,
          opacity: 0.18,
        }).addTo(map);

        // Top animated line
        routeLineRef.current = L.polyline(remainingPoints, {
          color: '#fc8019',
          weight: 4,
          opacity: 0.95,
          dashArray: '6, 10',
          className: 'animated-route-line',
        }).addTo(map);
      }
    } else {
      // Rider not active: Draw full Kitchen -> Customer path as glowing crawling route
      if (deliveryLat && deliveryLng) {
        const fullPoints: [number, number][] = [[kitchenLat, kitchenLng], [deliveryLat, deliveryLng]];

        routeLineBaseRef.current = L.polyline(fullPoints, {
          color: '#fc8019',
          weight: 7,
          opacity: 0.18,
        }).addTo(map);

        routeLineRef.current = L.polyline(fullPoints, {
          color: '#fc8019',
          weight: 4,
          opacity: 0.95,
          dashArray: '6, 10',
          className: 'animated-route-line',
        }).addTo(map);
      }
    }
  }, [mapReady, riderPosition, kitchenLat, kitchenLng, deliveryLat, deliveryLng]);

  // Update rider marker when position changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;

    if (riderPosition) {
      const latlng: [number, number] = [riderPosition.lat, riderPosition.lng];
      const heading = riderPosition.heading || 0;

      const getRiderHtml = (deg: number) => `
        <div class="custom-rider-marker">
          <!-- Upright speech bubble tooltip (Swiggy/Zomato style) -->
          <div class="rider-tooltip-bubble">
            <span class="rider-tooltip-text">
              ${riderPosition.eta ? `Arriving in ${riderPosition.eta} min` : 'Rider is on the way!'}
            </span>
            <div class="rider-tooltip-arrow"></div>
          </div>
          <!-- Concentric pulsing rings -->
          <div class="rider-pulse-rings">
            <div class="ring-1"></div>
            <div class="ring-2"></div>
          </div>
          <!-- Rotating bike wrapper (+90 offset to align West-facing emoji correctly) -->
          <div class="rider-bike-wrapper" style="transform: rotate(${(deg + 90) % 360}deg);">
            <span>🛵</span>
          </div>
        </div>
      `;

      if (riderMarkerRef.current) {
        // Cancel active animation frame to prevent concurrency/jitter issues
        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }

        // Smooth marker movement (Swiggy-style)
        const oldLatLng = riderMarkerRef.current.getLatLng();
        const steps = 30;
        const latDiff = (latlng[0] - oldLatLng.lat) / steps;
        const lngDiff = (latlng[1] - oldLatLng.lng) / steps;
        let step = 0;

        const animate = () => {
          if (step >= steps) {
            riderMarkerRef.current.setLatLng(latlng);
            riderMarkerRef.current.setIcon(L.divIcon({
              html: getRiderHtml(heading),
              className: 'custom-leaflet-marker',
              iconSize: [60, 60],
              iconAnchor: [30, 30],
            }));
            animationFrameIdRef.current = null;
            return;
          }
          step++;
          riderMarkerRef.current.setLatLng([
            oldLatLng.lat + latDiff * step,
            oldLatLng.lng + lngDiff * step,
          ]);
          animationFrameIdRef.current = requestAnimationFrame(animate);
        };
        animationFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        // Create rider marker
        const riderIcon = L.divIcon({
          html: getRiderHtml(heading),
          className: 'custom-leaflet-marker',
          iconSize: [60, 60],
          iconAnchor: [30, 30],
        });
        riderMarkerRef.current = L.marker(latlng, { icon: riderIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<b>🛵 ${escapeHtml(riderPosition.riderName || 'Delivery Partner')}</b>${riderPosition.eta ? `<br/>ETA: ${riderPosition.eta} min` : ''}`);
      }

      // Optionally re-center map to follow rider
      if (riderPosition.eta !== undefined && riderPosition.eta > 0) {
        map.panTo(latlng, { animate: true, duration: 0.5 });
      }
    }
  }, [riderPosition, mapReady, kitchenLat, kitchenLng, deliveryLat, deliveryLng]);

  // Clean up animation frames on unmount
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height, zIndex: 0 }} />

      {/* FAANG-style glassmorphic loading overlay */}
      {!mapReady && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(18, 18, 18, 0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, zIndex: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid rgba(252, 128, 25, 0.1)',
            borderTopColor: '#fc8019',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#767676', letterSpacing: '-0.1px' }}>
            Locating your delivery partner...
          </div>
        </div>
      )}

      {/* ETA overlay — Swiggy-style bottom card */}
      {riderPosition && riderPosition.eta !== undefined && riderPosition.eta > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12,
          background: 'rgba(20, 20, 20, 0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 1000,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#fc8019', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 20,
              boxShadow: '0 0 12px rgba(252,128,25,0.4)',
            }}>🛵</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                {riderPosition.riderName || 'Delivery Partner'}
              </div>
              <div style={{ fontSize: 12, color: '#aaaaaa', marginTop: 2 }}>
                {riderPosition.speed ? `${Math.round(riderPosition.speed)} km/h` : 'On the way'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fc8019', letterSpacing: '-0.5px' }}>
              {riderPosition.eta} min
            </div>
            <div style={{ fontSize: 10, color: '#888888', textTransform: 'uppercase', fontWeight: 700, marginTop: 1 }}>away</div>
          </div>
        </div>
      )}

      {/* Turn-by-turn directions overlay */}
      {riderPosition && deliveryLat && deliveryLng && (
        <DirectionsOverlay
          riderLat={riderPosition.lat}
          riderLng={riderPosition.lng}
          destinationLat={deliveryLat}
          destinationLng={deliveryLng}
        />
      )}

      {/* Live pulse indicator */}
      {riderPosition && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(20, 20, 20, 0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '6px 12px',
          fontSize: 10, fontWeight: 800, color: '#4caf50',
          letterSpacing: '0.5px',
          zIndex: 1000,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#4caf50', animation: 'pulse 1.5s infinite',
            boxShadow: '0 0 8px #4caf50',
          }} />
          LIVE TRACKING
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dash-crawl {
          to {
            stroke-dashoffset: -20;
          }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        .animated-route-line {
          stroke-dasharray: 8, 12;
          animation: dash-crawl 1.0s linear infinite !important;
        }
        .custom-leaflet-marker {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        /* Kitchen & Home Badges */
        .custom-marker {
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .marker-badge {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.45);
          z-index: 2;
        }
        .kitchen-badge {
          border: 2px solid #fc8019;
          background: #1e1e24;
        }
        .destination-badge {
          border: 2px solid #2e7d32;
          background: #1e1e24;
        }
        .marker-emoji {
          font-size: 16px;
        }
        .marker-pulse-ring {
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          z-index: 1;
          animation: marker-ripple 2s infinite;
        }
        .kitchen-pulse {
          background: rgba(252, 128, 25, 0.25);
        }
        .destination-pulse {
          background: rgba(46, 125, 50, 0.25);
        }
        @keyframes marker-ripple {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        /* Rider Marker */
        .custom-rider-marker {
          position: relative;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rider-tooltip-bubble {
          position: absolute;
          bottom: 56px;
          left: 50%;
          transform: translateX(-50%);
          background: #fc8019;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(252, 128, 25, 0.4);
          z-index: 10;
          border: 1px solid rgba(255, 255, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .rider-tooltip-arrow {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid #fc8019;
        }
        .rider-pulse-rings {
          position: absolute;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          pointer-events: none;
        }
        .rider-pulse-rings .ring-1, .rider-pulse-rings .ring-2 {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(252, 128, 25, 0.25);
          animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .rider-pulse-rings .ring-2 {
          animation-delay: 1.25s;
        }
        .rider-bike-wrapper {
          position: relative;
          z-index: 2;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #fc8019;
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }
      `}</style>
    </div>
  );
}
