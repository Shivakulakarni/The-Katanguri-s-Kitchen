import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Detect placeholder / unconfigured values
const isPlaceholder = (v: string) =>
  !v || v.includes('CHANGE_ME') || v.includes('YOUR_PROJECT') || v === 'null';

const supabaseConfigured =
  supabaseUrl && supabaseServiceKey &&
  !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseServiceKey);

if (!supabaseConfigured) {
  logger.warn('[SUPABASE] Missing or placeholder credentials. Auth falls back to local JWT/OTP.');
}

/**
 * Server-side Supabase client with service role key.
 * Used in Fastify routes for auth operations and database access.
 * This client bypasses RLS — use for admin/server operations only.
 */
export const supabaseAdmin = supabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Supabase client with a user's JWT token for RLS-aware queries.
 * Pass the user's access_token to scope queries to their permissions.
 */
export function createSupabaseUserClient(accessToken: string) {
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase not configured');
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
