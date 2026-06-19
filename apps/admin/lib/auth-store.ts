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
      if (supabase) await supabase.auth.signOut();
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore network errors on logout
    }
    set({ user: null, token: null, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      // Check Supabase session first (for Google OAuth)
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Exchange Supabase session for our admin cookie
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
              set({
                user: { id: data.user.id, email: data.user.email, name: data.user.name, role: data.user.role },
                token: data.accessToken || data.token || 'supabase-session',
                isLoading: false,
              });
              return;
            } else {
              // Not an admin — sign out from Supabase
              await supabase.auth.signOut();
            }
          }
        }
      }

      // Fallback: check cookie-based session
      const res = await fetch('/api/v1/customer/profile', { credentials: 'include' });
      if (res.ok) {
        const profileData = await res.json();
        const c = profileData?.customer || profileData;
        if (c && c.id && c.role === 'admin') {
          set({
            user: { id: c.id, email: c.email || '', name: c.name || '', role: c.role || 'customer' },
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
