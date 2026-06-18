import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = supabaseUrl && 
                     supabaseAnonKey && 
                     !supabaseUrl.includes('YOUR_PROJECT') && 
                     supabaseAnonKey !== 'CHANGE_ME' &&
                     supabaseAnonKey.startsWith('eyJ');

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { log_level: 'info' } },
    })
  : null;
