import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * Atlas runs in one of two modes:
 *
 *  - **cloud** — credentials present: Supabase auth, Postgres and realtime.
 *  - **local** — no credentials: everything lives in localStorage under one
 *    device-local account.
 *
 * The mode is decided once, at module load, from build-time env vars. Every
 * feature in the app works in both; only sharing and cross-device sync need
 * the cloud.
 */
export const isCloud = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isCloud
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The app is served from a static host and uses HashRouter, so the
        // OAuth/magic-link fragment must be consumed by the client itself.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

/** Narrowing helper so call sites don't repeat the null check. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    )
  }
  return supabase
}
