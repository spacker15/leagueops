import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — only created on first use so that build-time SSR pages
// that catch Supabase errors don't crash during static page generation when
// env vars are absent (e.g. local builds without .env.local).
let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Supabase environment variables are not configured.')
    }
    _client = createClient(url, key)
  }
  return _client
}

// Backward-compatible named export used throughout the app
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
