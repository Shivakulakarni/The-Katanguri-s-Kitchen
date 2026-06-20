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
  _refreshing: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  requestOtp: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ error?: string }>;
  refreshTokens: () => Promise<boolean>;
  ensureValidToken: () => Promise<string | null>;
}

const TOKEN_KEY = 'tkn_access';
const REFRESH_KEY = 'tkn_refresh';
const USER_KEY = 'tkn_user';

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

function persistAuth(user: User, token: string, refreshToken?: string) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {}
}

function clearPersistedAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

function loadPersistedAuth(): { user: User | null; token: string | null; refreshToken: string | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return { user: null, token: null, refreshToken: null };
    const user = JSON.parse(userStr) as User;
    return { user, token, refreshToken };
  } catch {
    return { user: null, token: null, refreshToken: null };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,
  _refreshing: false,

  setAuth: (user, token, refreshToken?: string) => {
    persistAuth(user, token, refreshToken);
    set({ user, token, refreshToken: refreshToken || null, isLoading: false });
  },

  logout: async () => {
    const cur = get();
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: cur.token ? { Authorization: `Bearer ${cur.token}` } : {},
        credentials: 'include',
      });
    } catch {}
    try {
      const supabase = createBrowserClient();
      if (supabase) await supabase.auth.signOut();
    } catch {}
    clearPersistedAuth();
    set({ user: null, token: null, refreshToken: null, isLoading: false });
  },

  loadFromStorage: async () => {
    const persisted = loadPersistedAuth();
    if (persisted.token && persisted.user) {
      if (!isTokenExpired(persisted.token)) {
        set({ ...persisted, isLoading: false });
        return;
      }
      if (persisted.refreshToken) {
        set({ _refreshing: true });
        try {
          const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refreshToken: persisted.refreshToken }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.accessToken) {
              const refreshedUser = data.user || persisted.user;
              persistAuth(refreshedUser, data.accessToken, data.refreshToken || persisted.refreshToken);
              set({ user: refreshedUser, token: data.accessToken, refreshToken: data.refreshToken || persisted.refreshToken, isLoading: false, _refreshing: false });
              return;
            }
          }
        } catch {}
        set({ _refreshing: false });
      }
      clearPersistedAuth();
      set({ isLoading: false });
      return;
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
      get().setAuth(data.user, data.accessToken, data.refreshToken);
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
      get().setAuth(data.user, data.accessToken, data.refreshToken);
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
      get().setAuth(data.user, data.accessToken, data.refreshToken);
      return {};
    } catch (err: unknown) {
      const error = ensureAppError(err);
      reportError(error, { action: 'verifyOtp' });
      return { error: error.message || 'OTP verification failed' };
    }
  },

  refreshTokens: async () => {
    const cur = get();
    const refreshToken = cur.refreshToken || loadPersistedAuth().refreshToken;
    if (!refreshToken || cur._refreshing) return false;

    set({ _refreshing: true });
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearPersistedAuth();
        set({ user: null, token: null, refreshToken: null, _refreshing: false });
        return false;
      }
      const data = await res.json();
      if (data.accessToken) {
        const user = data.user || cur.user!;
        persistAuth(user, data.accessToken, data.refreshToken || refreshToken);
        set({ user, token: data.accessToken, refreshToken: data.refreshToken || refreshToken, _refreshing: false });
        return true;
      }
      clearPersistedAuth();
      set({ user: null, token: null, refreshToken: null, _refreshing: false });
      return false;
    } catch (err: unknown) {
      reportError(ensureAppError(err), { action: 'refreshTokens' });
      set({ _refreshing: false });
      return false;
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
