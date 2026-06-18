'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface OrderEvent {
  type: 'initial' | 'status_change' | 'connected' | 'heartbeat';
  event?: string;
  orderId?: number;
  payload?: Record<string, any>;
  timestamp?: string;
  order?: {
    id: number;
    status: string;
    totalAmount: string;
    dispatchId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  history?: Array<{
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
    createdAt: string;
  }>;
}

interface UseOrderStreamOptions {
  orderId: number | null;
  onEvent?: (event: OrderEvent) => void;
  onStatusChange?: (status: string) => void;
  enabled?: boolean;
  token?: string | null;
}

export function useOrderStream({ orderId, onEvent, onStatusChange, enabled = true, token }: UseOrderStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<OrderEvent | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderEvent['history']>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10;

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!orderId || !enabled) return;
    cleanup();

    const es = new EventSource(`/api/v1/orders/${orderId}/stream`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
    };

    es.onmessage = (event) => {
      if (event.data === ':heartbeat' || event.data === ':connected') return;

      try {
        const data: OrderEvent = JSON.parse(event.data);
        setLastEvent(data);

        if (data.type === 'initial' && data.order) {
          setCurrentStatus(data.order.status);
          setOrderHistory(data.history || []);
        } else if (data.type === 'status_change' && data.event) {
          // Derive status from event name
          const statusMap: Record<string, string> = {
            'order.placed': 'PENDING',
            'order.confirmed': 'CONFIRMED',
            'order.preparation_started': 'PREPARING',
            'order.ready': 'READY',
            'order.out_for_delivery': 'OUT_FOR_DELIVERY',
            'order.delivered': 'DELIVERED',
            'order.cancelled': 'CANCELLED',
          };
          const newStatus = statusMap[data.event];
          if (newStatus) {
            setCurrentStatus(newStatus);
            onStatusChange?.(newStatus);
          }
        }

        onEvent?.(data);
      } catch {
        // ignore JSON parse/event errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      if (retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [orderId, enabled, onEvent, onStatusChange, cleanup, token]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return { isConnected, lastEvent, currentStatus, orderHistory };
}
