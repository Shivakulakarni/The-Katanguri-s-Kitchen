'use client';

import { createContext, useContext } from 'react';

export type RealtimePayload = {
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
  eventId: string;
};

export interface RealtimeContextValue {
  payload: RealtimePayload | null;
  status: 'connecting' | 'connected' | 'disconnected';
  isLive: boolean;
}

const defaultContext: RealtimeContextValue = {
  payload: null,
  status: 'connecting',
  isLive: false,
};

export const RealtimeContext = createContext<RealtimeContextValue>(defaultContext);

/**
 * Hook to consume the shared realtime context.
 * The connection is managed by AdminToastProvider — this just reads the data.
 */
export function useRealtimeContext() {
  return useContext(RealtimeContext);
}
