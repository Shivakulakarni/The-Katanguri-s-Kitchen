'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';

type RealtimePayload = {
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
  eventId: string;
};

type ChannelFilter = {
  event?: string;
  orderId?: number;
};

/**
 * Subscribe to Supabase Realtime broadcasts on the kitchen-live channel.
 * Returns the latest payload and connection status.
 */
export function useRealtime(filter?: ChannelFilter) {
  const [payload, setPayload] = useState<RealtimePayload | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const channelRef = useRef<any>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (supabase) {
      const channel = supabase.channel('kitchen-live');

      channel
        .on('broadcast', { event: '*' }, (msg) => {
          const data = msg.payload as RealtimePayload;
          if (!data || !data.event) return;

          // Apply filters
          if (filter?.event && data.event !== filter.event) return;
          if (filter?.orderId && data.payload?.orderId !== filter.orderId) return;

          setPayload(data);
        })
        .subscribe((subStatus) => {
          setStatus(subStatus === 'SUBSCRIBED' ? 'connected' : subStatus === 'CHANNEL_ERROR' ? 'disconnected' : 'connecting');
        });

      channelRef.current = channel;
    } else {
      // Local SSE (Server-Sent Events) Fallback Connection
      let sseUrl = '';
      if (filter?.orderId) {
        sseUrl = `/api/v1/orders/${filter.orderId}/stream`;
      } else {
        sseUrl = '/api/v1/menu/stream';
      }

      const eventSource = new EventSource(sseUrl, { withCredentials: true });

      eventSource.onopen = () => {
        setStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.event) {
            // Apply filters
            if (filter?.event && data.event !== filter.event) return;
            if (filter?.orderId && data.orderId !== filter.orderId) return;

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
        // Check if EventSource is permanently closed
        if (eventSource.readyState === EventSource.CLOSED) {
          setStatus('disconnected');
        } else if (statusRef.current === 'connected') {
          // Transient error — EventSource will auto-reconnect
          setStatus('connecting');
        } else {
          setStatus('disconnected');
        }
      };

      sseRef.current = eventSource;
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [filter?.event, filter?.orderId]);

  return { payload, status };
}

/**
 * Subscribe to a specific event type and call back on every update.
 */
export function useRealtimeEvent<T = any>(event: string, cb: (data: T) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const { payload } = useRealtime({ event });

  useEffect(() => {
    if (payload) {
      cbRef.current(payload.payload as T);
    }
  }, [payload]);
}

/**
 * Hook for live order tracking — returns latest order status and history.
 */
export function useOrderStream(orderId: number) {
  const [orderData, setOrderData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { payload, status } = useRealtime({ orderId });

  useEffect(() => {
    if (payload && (payload.event.startsWith('order.') || payload.event.startsWith('dispatch.'))) {
      setOrderData((prev: any) => ({
        ...prev,
        ...payload.payload,
        event: payload.event,
        timestamp: payload.timestamp,
      }));
    }
  }, [payload]);

  // Fetch initial data (with auth if available)
  useEffect(() => {
    if (!orderId || orderId <= 0) return;
    fetch(`/api/v1/orders/${orderId}`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) {
          setFetchError('Sign in to view order details');
          return null;
        }
        return r.json();
      })
      .then(data => { if (data) setOrderData(data); })
      .catch(() => setFetchError('Failed to load order'));
  }, [orderId]);

  return { orderData, status, isLive: status === 'connected', fetchError };
}
