import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: ReturnType<typeof createClient> | null = null;

/**
 * Create or return a singleton Supabase browser client.
 * Returns null if Supabase is not configured (graceful fallback to legacy auth).
 */
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_PROJECT') || supabaseAnonKey === 'CHANGE_ME') return null;
  if (_client) return _client;
  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

/** Check if Supabase is configured */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('YOUR_PROJECT') && supabaseAnonKey !== 'CHANGE_ME');
}
