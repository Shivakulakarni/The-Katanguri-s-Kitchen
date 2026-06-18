'use client';

import { create } from 'zustand';
import { createBrowserClient } from './supabase-client';
import { ensureAppError, reportError } from './errors';

interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  /** Whether a token refresh is currently in progress */
  _refreshing: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  requestOtp: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ error?: string }>;
  refreshTokens: () => Promise<boolean>;
  /** Check if token is expired and refresh if needed */
  ensureValidToken: () => Promise<string | null>;
}

/** Decode JWT payload without verification (client-side only, for expiry check) */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  const expiresAt = payload.exp * 1000;
  return Date.now() >= expiresAt - bufferSeconds * 1000;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,
  _refreshing: false,

  setAuth: (user, token, refreshToken?: string) => {
    set({ user, token, refreshToken: refreshToken || null, isLoading: false });
  },

  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore network errors on logout
    }
    try {
      const supabase = createBrowserClient();
      if (supabase) await supabase.auth.signOut();
    } catch {
      // ignore supabase signout errors
    }
    set({ user: null, token: null, refreshToken: null, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      const res = await fetch('/api/v1/customer/profile', { credentials: 'include' });
      if (res.ok) {
        const profileData = await res.json();
        const customer = profileData.customer || profileData;
        if (customer && customer.id) {
          set({
            user: {
              id: customer.id,
              email: customer.email || '',
              name: customer.name || '',
              phone: customer.phone || '',
              role: customer.role || 'customer',
            },
            token: 'cookie-auth',
            isLoading: false,
          });
          return;
        }
      }
    } catch {
      // Not authenticated — fall through
    }
    set({ isLoading: false });
  },

  login: async (email, password) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      if (!data.user) return { error: 'Invalid server response' };
      get().setAuth(data.user, data.token, data.refreshToken);
      return {};
    } catch (err: unknown) {
      const error = ensureAppError(err);
      reportError(error, { action: 'login' });
      return { error: error.category === 'network'
        ? 'Network error — please check your connection'
        : error.message || 'Login failed' };
    }
  },

  register: async (email, password, name) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      if (!data.user) return { error: 'Invalid server response' };
      get().setAuth(data.user, data.token, data.refreshToken);
      return {};
    } catch (err: unknown) {
      const error = ensureAppError(err);
      reportError(error, { action: 'register' });
      return { error: error.category === 'network'
        ? 'Network error — please check your connection'
        : error.message || 'Registration failed' };
    }
  },

  requestOtp: async (phone) => {
    try {
      const res = await fetch('/api/v1/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      return {};
    } catch (err: unknown) {
      const error = ensureAppError(err);
      reportError(error, { action: 'requestOtp' });
      return { error: error.message || 'OTP request failed' };
    }
  },

  verifyOtp: async (phone, otp, name) => {
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, otp, name }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      if (!data.user) return { error: 'Invalid server response' };
      get().setAuth(data.user, data.token, data.refreshToken);
      return {};
    } catch (err: unknown) {
      const error = ensureAppError(err);
      reportError(error, { action: 'verifyOtp' });
      return { error: error.message || 'OTP verification failed' };
    }
  },

  refreshTokens: async () => {
    const cur = get();
    if (!cur.refreshToken || cur._refreshing) return false;

    set({ _refreshing: true });
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: cur.refreshToken }),
      });
      if (!res.ok) {
        get().logout();
        return false;
      }
      const data = await res.json();
      if (data.token) {
        get().setAuth(data.user || cur.user!, data.token, data.refreshToken || cur.refreshToken);
        return true;
      }
      get().logout();
      return false;
    } catch (err: unknown) {
      reportError(ensureAppError(err), { action: 'refreshTokens' });
      return false;
    } finally {
      set({ _refreshing: false });
    }
  },

  ensureValidToken: async () => {
    const { token, _refreshing, refreshTokens } = get();
    if (!token) return null;
    if (!isTokenExpired(token)) return token;
    if (_refreshing) return null;
    const success = await refreshTokens();
    return success ? get().token : null;
  },
}));
