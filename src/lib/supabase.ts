import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Si las credenciales no están configuradas, usamos el fallback de localStorage y demo_mode
export const isSupabaseConfigured: boolean = supabaseUrl !== '' && supabaseAnonKey !== '';

/** Realtime WebSocket (requiere proxy WSS en Supabase self-hosted). Desactivar si falla la conexión. */
export const isRealtimeEnabled: boolean =
  process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED !== 'false';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null;
