'use client';

import { create } from 'zustand';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AdminAuthState {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: AdminUser, token: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  login: (email: string, password: string) => Promise<{ error?: string }>;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    set({ user, token, isLoading: false });
  },

  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore network errors on logout
    }
    set({ user: null, token: null, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      const res = await fetch('/api/v1/customer/profile', {
        credentials: 'include',
      });
      if (res.ok) {
        const profileData = await res.json();
        const c = profileData?.customer || profileData;
        if (c && c.id && c.role === 'admin') {
          set({
            user: {
              id: c.id,
              email: c.email || '',
              name: c.name || '',
              role: c.role || 'customer',
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
      const res = await fetch('/api/v1/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      const authToken = data.token || data.accessToken;
      if (!authToken) {
        return { error: 'Login failed — no authentication token received' };
      }
      const userRole = data.user?.role;
      if (!userRole || userRole !== 'admin') {
        return { error: 'Admin access required. Your account does not have admin privileges.' };
      }
      get().setAuth(data.user, authToken);
      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  },
}));
