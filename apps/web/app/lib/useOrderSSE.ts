'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from './auth-store';

export const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']);

/**
 * Shared SSE hook for real-time order status tracking.
 * Replaces duplicated SSE logic across orders/page.tsx and account/page.tsx.
 */
export function useOrderSSE(orders: { id: number; status: string }[]) {
  const { token } = useAuthStore();
  const [liveStatuses, setLiveStatuses] = useState<Record<number, string>>({});
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const sseRefs = useRef<Map<number, EventSource>>(new Map());
  const flashTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const ordersRef = useRef<{ id: number; status: string }[]>([]);
  const liveStatusesRef = useRef<Record<number, string>>({});

  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { liveStatusesRef.current = liveStatuses; }, [liveStatuses]);

  const getStatus = useCallback((order: { id: number; status: string }) => liveStatusesRef.current[order.id] || order.status, []);

  const openOrderSSE = useCallback((order: { id: number; status: string }) => {
    const existing = sseRefs.current;
    if (existing.has(order.id)) return;
    const es = new EventSource(`/api/v1/orders/${order.id}/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'status_change' && evt.payload?.status) {
          const newStatus = evt.payload.status;
          setLiveStatuses(prev => ({ ...prev, [order.id]: newStatus }));
          setFlashIds(prev => { const s = new Set(prev); s.add(order.id); return s; });
          if (flashTimeouts.current.has(order.id)) clearTimeout(flashTimeouts.current.get(order.id)!);
          flashTimeouts.current.set(order.id, setTimeout(() => {
            setFlashIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
            flashTimeouts.current.delete(order.id);
          }, 2000));
          if (!ACTIVE_STATUSES.has(newStatus)) {
            es.close();
            existing.delete(order.id);
          }
        }
      } catch { /* SSE parse failure */ }
    };
    existing.set(order.id, es);
  }, []);

  // Open SSE for active orders on mount / user change
  useEffect(() => {
    if (orders.length === 0) return;
    const activeOrders = orders.filter(o => {
      const status = liveStatuses[o.id] || o.status;
      return ACTIVE_STATUSES.has(status);
    });
    for (const order of activeOrders) openOrderSSE(order);
    return () => {
      for (const es of Array.from(sseRefs.current.values())) es.close();
      sseRefs.current.clear();
      for (const t of flashTimeouts.current.values()) clearTimeout(t);
      flashTimeouts.current.clear();
    };
  }, [token, orders.length]);

  // Re-sync SSE when orders change
  useEffect(() => {
    if (orders.length === 0) return;
    const activeOrders = orders.filter(o => {
      const status = liveStatuses[o.id] || o.status;
      return ACTIVE_STATUSES.has(status);
    });
    const existing = sseRefs.current;
    for (const [id, es] of Array.from(existing.entries())) {
      if (!activeOrders.find(o => o.id === id)) { es.close(); existing.delete(id); }
    }
    for (const order of activeOrders) openOrderSSE(order);
  }, [orders, openOrderSSE]);

  return { liveStatuses, flashIds, getStatus };
}
