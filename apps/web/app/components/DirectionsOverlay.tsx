'use client';

import { useEffect, useState, useCallback } from 'react';

interface DirectionStep {
  instruction: string;
  streetName: string;
  distance: number; // meters
  duration: number; // seconds
  maneuverType: 'turn' | 'depart' | 'arrive' | 'new name' | 'merge' | 'roundabout' | 'fork' | 'continue' | 'roundabout turn';
  modifier?: 'left' | 'right' | 'slight left' | 'slight right' | 'sharp left' | 'sharp right' | 'straight' | 'uturn';
}

interface DirectionsOverlayProps {
  riderLat: number;
  riderLng: number;
  destinationLat: number;
  destinationLng: number;
}

const TURN_ICONS: Record<string, string> = {
  'depart': '🚀',
  'arrive': '🏁',
  'turn left': '⬅️',
  'turn right': '➡️',
  'slight left': '↖️',
  'slight right': '↗️',
  'sharp left': '↩️',
  'sharp right': '↪️',
  'straight': '⬆️',
  'uturn': '🔄',
  'new name': '↗️',
  'merge': '🔀',
  'fork': '⚡',
  'continue': '⬆️',
  'roundabout': '🔄',
  'roundabout turn': '🔄',
};

function getDirectionIcon(step: DirectionStep): string {
  const key = step.modifier
    ? `${step.maneuverType} ${step.modifier}`
    : step.maneuverType;
  return TURN_ICONS[key] || TURN_ICONS[step.maneuverType] || '📍';
}

function getDirectionText(step: DirectionStep): string {
  if (step.maneuverType === 'depart') return 'Start toward';
  if (step.maneuverType === 'arrive') return 'Arrive at';
  if (step.maneuverType === 'roundabout') return 'At roundabout, take exit toward';

  const modifier = step.modifier ? step.modifier.replace('sharp', 'hard') : '';
  const verb = step.maneuverType === 'continue' ? 'Continue' : 'Turn';
  return `${verb}${modifier ? ' ' + modifier : ''} onto`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}min`;
}

// Cache for route requests to avoid duplicate calls
const routeCache = new Map<string, DirectionStep[]>();

export default function DirectionsOverlay({
  riderLat,
  riderLng,
  destinationLat,
  destinationLng,
}: DirectionsOverlayProps) {
  const [steps, setSteps] = useState<DirectionStep[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDirections = useCallback(async () => {
    // Don't fetch if rider is very close to destination
    const dist = Math.sqrt(
      Math.pow(riderLat - destinationLat, 2) +
      Math.pow(riderLng - destinationLng, 2)
    );
    if (dist < 0.0005) { // ~50m
      setSteps([{ instruction: 'Arrive at destination', streetName: '', distance: 0, duration: 0, maneuverType: 'arrive' }]);
      return;
    }

    const cacheKey = `${riderLat.toFixed(5)},${riderLng.toFixed(5)}->${destinationLat.toFixed(5)},${destinationLng.toFixed(5)}`;

    // Check cache (valid for 15 seconds)
    const cached = routeCache.get(cacheKey);
    if (cached) {
      setSteps(cached);
      return;
    }

    setLoading(true);

    try {
      // Use OSRM demo server for free routing
      const url = `https://router.project-osrm.org/route/v1/driving/${riderLng},${riderLat};${destinationLng},${destinationLat}?overview=full&steps=true&geometries=geojson`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Routing service unavailable');

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      const legs = route.legs[0];

      if (!legs || !legs.steps) {
        throw new Error('No steps available');
      }

      const directionSteps: DirectionStep[] = legs.steps.map((step: any) => ({
        instruction: step.maneuver?.type || 'continue',
        streetName: step.name || 'unnamed road',
        distance: step.distance || 0,
        duration: step.duration || 0,
        maneuverType: step.maneuver?.type || 'continue',
        modifier: step.maneuver?.modifier,
      }));

      // Cache the result
      routeCache.set(cacheKey, directionSteps);

      // Limit cache size
      if (routeCache.size > 50) {
        const firstKey = routeCache.keys().next().value;
        if (firstKey) routeCache.delete(firstKey);
      }

      setSteps(directionSteps);
    } catch {
      // If routing fails, provide fallback directions based on bearing
      const bearing = Math.atan2(destinationLng - riderLng, destinationLat - riderLat) * (180 / Math.PI);
      let direction = 'toward your destination';
      if (bearing > -45 && bearing <= 45) direction = 'toward the northeast';
      else if (bearing > 45 && bearing <= 135) direction = 'toward the southeast';
      else if (bearing > 135 || bearing <= -135) direction = 'toward the southwest';
      else direction = 'toward the northwest';

      setSteps([{
        instruction: `Head ${direction}`,
        streetName: 'Your route',
        distance: 0,
        duration: 0,
        maneuverType: 'depart',
      }]);

    } finally {
      setLoading(false);
    }
  }, [riderLat, riderLng, destinationLat, destinationLng]);

  useEffect(() => {
    fetchDirections();
    // Refresh directions every 15 seconds
    const interval = setInterval(fetchDirections, 15000);
    return () => clearInterval(interval);
  }, [fetchDirections]);

  // Get current step (first step with remaining distance > 0)
  const currentStep = steps[0];
  const nextStep = steps.length > 1 ? steps[1] : null;

  if (loading && steps.length === 0) {
    return (
      <div style={{
        position: 'absolute', top: 56, left: 12, right: 12,
        background: 'rgba(20, 20, 20, 0.9)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '12px 16px',
        zIndex: 1000,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(252,128,25,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>⏳</div>
          <div style={{ fontSize: 13, color: '#aaa', fontWeight: 600 }}>
            Loading directions...
          </div>
        </div>
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 56, left: 12, right: 12,
      zIndex: 1000,
    }}>
      {/* Current Direction */}
      {currentStep && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.9)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: currentStep.maneuverType === 'arrive'
                ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                : 'linear-gradient(135deg, #fc8019 0%, #e65100 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, boxShadow: '0 4px 12px rgba(252,128,25,0.3)',
            }}>
              {getDirectionIcon(currentStep)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {getDirectionText(currentStep)}
              </div>
              <div style={{
                fontSize: 16, fontWeight: 800, color: '#fff',
                marginTop: 2, lineHeight: 1.2,
              }}>
                {currentStep.streetName || 'Continue straight'}
              </div>
            </div>
            {currentStep.distance > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fc8019' }}>
                  {formatDistance(currentStep.distance)}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                  {formatDuration(currentStep.duration)}
                </div>
              </div>
            )}
          </div>

          {/* Next step preview */}
          {nextStep && (
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>{getDirectionIcon(nextStep)}</span>
              <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                Then {nextStep.modifier ? `${nextStep.modifier} ` : ''}onto{' '}
                <span style={{ color: '#767676', fontWeight: 600 }}>
                  {nextStep.streetName || 'next road'}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step indicators (pill dots) */}
      {steps.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 4,
          marginTop: 8,
        }}>
          {steps.slice(0, Math.min(steps.length, 8)).map((_step, i) => (
            <div key={i} style={{
              width: i === 0 ? 20 : 6, height: 6, borderRadius: 3,
              background: i === 0 ? '#fc8019' : 'rgba(252,128,25,0.3)',
              transition: 'all 0.3s ease',
            }} />
          ))}
          {steps.length > 8 && (
            <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>+{steps.length - 8}</span>
          )}
        </div>
      )}
    </div>
  );
}
