'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { useAdminAuthStore } from './auth-store';

type RealtimePayload = {
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
  eventId: string;
};

export function useRealtime() {
  const [payload, setPayload] = useState<RealtimePayload | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const channelRef = useRef<any>(null);
  const sseRef = useRef<EventSource | null>(null);
  const errorCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = useAdminAuthStore.getState().token;

    // --- 1. Supabase Realtime Subscription ---
    if (supabase) {
      const channel = supabase.channel('kitchen-live');
      channel
        .on('broadcast', { event: '*' }, (msg) => {
          const data = msg.payload as RealtimePayload;
          if (data?.event) {
            setPayload(data);
            setStatus('connected');
          }
        })
        .subscribe((subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            setStatus('connected');
          }
        });
      channelRef.current = channel;
    }

    // --- 2. Local SSE (Server-Sent Events) Fallback Connection ---
    if (token) {
      const connect = () => {
        const eventSource = new EventSource('/api/v1/admin/orders/stream', { withCredentials: true });

        eventSource.onopen = () => {
          errorCountRef.current = 0;
          setStatus('connected');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.event) {
              setPayload({
                event: data.event,
                payload: data.payload,
                timestamp: data.timestamp || new Date().toISOString(),
                eventId: `${data.event}_${Date.now()}`
              });
              setStatus('connected');
            }
          } catch {
            // ignore JSON parsing errors
          }
        };

        eventSource.onerror = () => {
          errorCountRef.current += 1;
          const errors = errorCountRef.current;
          console.warn(`[SSE] Connection error #${errors}`);
          eventSource.close();
          setStatus('disconnected');
          // Exponential backoff starting from first error
          const delay = Math.min(1000 * 2 ** Math.min(errors - 1, 5), 30000);
          reconnectTimerRef.current = setTimeout(connect, delay);
        };

        sseRef.current = eventSource;
      };

      connect();
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return { payload, status, isLive: status === 'connected' };
}
