import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  // Support both new-style (sb_publishable_) and legacy (eyJ) keys
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey, {
    auth: {
      persistSession: false,
    },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {}
      },
    },
  })
}
