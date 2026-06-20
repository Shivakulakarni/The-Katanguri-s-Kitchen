'use client';

import { useMemo } from 'react';
import { useAdminAuthStore } from './auth-store';

/**
 * Returns authorization headers with the Bearer token from the auth store.
 * Must be called inside a React component or hook after store initialization.
 */
export function useAuthHeaders(): Record<string, string> {
  const token = useAdminAuthStore(s => s.token);
  return useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }, [token]);
}

/**
 * Returns authorization headers for admin API calls.
 * When token is 'cookie-auth', relies on browser cookie only (no Authorization header).
 */
export function getAuthHeaders(): Record<string, string> {
  const token = useAdminAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && token !== 'cookie-auth' && token !== 'cookie-session') {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}
