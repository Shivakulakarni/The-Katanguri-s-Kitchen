'use client';

import { useEffect, useRef } from 'react';
import { ToastContainer } from './components/Toast';
import { toast } from '../lib/toast-store';
import { useRealtime } from '../lib/useRealtime';
import { RealtimeContext, type RealtimeContextValue } from './realtime-context';

/**
 * Wraps the admin shell with toast notifications AND provides a shared
 * realtime context so child components don't create duplicate subscriptions.
 */
export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const { payload, status, isLive } = useRealtime();
  const lastEventRef = useRef<string | null>(null);

  useEffect(() => {
    if (!payload) return;

    // Deduplicate rapid-fire events
    const eventKey = `${payload.event}_${payload.timestamp}`;
    if (eventKey === lastEventRef.current) return;
    lastEventRef.current = eventKey;

    const p = payload.payload as Record<string, unknown>;

    switch (payload.event) {
      // ── Order Events ──
      case 'order.placed':
        toast.info(
          'New Order',
          `Order #${p.orderId || 'unknown'} placed — ₹${p.totalAmount || 0}`
        );
        break;

      case 'order.cancelled':
        toast.warning(
          '❌ Order Cancelled',
          `Order #${p.orderId || 'unknown'} was cancelled`
        );
        break;

      // ── Dispatch Events ──
      case 'dispatch.rider_assigned':
        toast.success(
          '🏍️ Rider Assigned',
          `Rider assigned to order #${p.orderId || 'unknown'}`
        );
        break;

      case 'dispatch.rider_arrived':
        toast.info(
          'Rider Arrived',
          `Rider arrived at restaurant for order #${p.orderId || 'unknown'}`
        );
        break;

      case 'dispatch.delivery_failed':
        toast.error(
          'Delivery Failed',
          `Delivery failed for order #${p.orderId || 'unknown'} — ${p.reason || 'Unknown reason'}`
        );
        break;

      // ── Circuit Breaker Events ──
      case 'circuit_breaker.opened':
        toast.error(
          '🔴 Circuit Breaker Opened',
          `${p.name || 'Unknown'} service is failing — requests being rejected`
        );
        break;

      case 'circuit_breaker.recovered':
        toast.success(
          '🟢 Circuit Breaker Recovered',
          `${p.name || 'Unknown'} service is back online`
        );
        break;

      // ── Rider Status Events ──
      case 'rider.status_changed':
        toast.info(
          '🏍️ Rider Status Update',
          `Rider ${p.riderName || 'unknown'}: ${p.status || 'updated'}`
        );
        break;

      case 'rider.out_for_delivery':
        toast.info(
          '🚴 Out for Delivery',
          `Rider picked up order #${p.orderId || 'unknown'}`
        );
        break;

      case 'rider.delivered':
        toast.success(
          '✅ Delivered',
          `Order #${p.orderId || 'unknown'} delivered successfully`
        );
        break;

      default:
        break;
    }
  }, [payload]);

  const ctxValue: RealtimeContextValue = { payload, status, isLive };

  return (
    <RealtimeContext.Provider value={ctxValue}>
      <ToastContainer />
      {children}
    </RealtimeContext.Provider>
  );
}
