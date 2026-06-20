'use client';

import { create } from 'zustand';
import { supabase } from './supabase';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AdminAuthState {
  user: AdminUser | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: AdminUser, token: string, refreshToken?: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  login: (email: string, password: string) => Promise<{ error?: string }>;
}

const ADMIN_TOKEN_KEY = 'admin_tkn';
const ADMIN_REFRESH_KEY = 'admin_rtkn';
const ADMIN_USER_KEY = 'admin_usr';

function persistAdmin(user: AdminUser, token: string, refreshToken?: string) {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    if (refreshToken) localStorage.setItem(ADMIN_REFRESH_KEY, refreshToken);
  } catch {}
}

function clearAdmin() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  } catch {}
}

function loadAdmin(): { user: AdminUser | null; token: string | null; refreshToken: string | null } {
  try {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const refreshToken = localStorage.getItem(ADMIN_REFRESH_KEY);
    const userStr = localStorage.getItem(ADMIN_USER_KEY);
    if (!token || !userStr) return { user: null, token: null, refreshToken: null };
    return { user: JSON.parse(userStr), token, refreshToken };
  } catch {
    return { user: null, token: null, refreshToken: null };
  }
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,

  setAuth: (user, token, refreshToken?: string) => {
    persistAdmin(user, token, refreshToken);
    set({ user, token, refreshToken: refreshToken || null, isLoading: false });
  },

  logout: async () => {
    try {
      if (supabase) await supabase.auth.signOut();
      const cur = get();
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: cur.token ? { Authorization: `Bearer ${cur.token}` } : {},
        credentials: 'include',
      });
    } catch {}
    clearAdmin();
    set({ user: null, token: null, refreshToken: null, isLoading: false });
  },

  loadFromStorage: async () => {
    const persisted = loadAdmin();
    if (persisted.token && persisted.user) {
      set({ ...persisted, isLoading: false });
      return;
    }

    // Fallback: check Supabase session
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const res = await fetch('/api/v1/auth/social', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              accessToken: session.access_token,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user?.role === 'admin') {
              const user = { id: data.user.id, email: data.user.email, name: data.user.name, role: data.user.role };
              const token = data.accessToken || data.token || session.access_token;
              persistAdmin(user, token, data.refreshToken);
              set({ user, token, refreshToken: data.refreshToken || null, isLoading: false });
              return;
            } else {
              await supabase.auth.signOut();
            }
          }
        }
      }
    } catch {}

    set({ isLoading: false });
  },

  login: async (email, password) => {
    try {
      const res = await fetch('/api/v1/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      const authToken = data.accessToken || data.token;
      if (!authToken) {
        return { error: 'Login failed — no authentication token received' };
      }
      const userRole = data.user?.role;
      if (!userRole || userRole !== 'admin') {
        return { error: 'Admin access required. Your account does not have admin privileges.' };
      }
      get().setAuth(data.user, authToken, data.refreshToken);
      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  },
}));
