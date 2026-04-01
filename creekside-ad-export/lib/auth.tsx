'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/supabase/client'
import type { UserRole, AppRole } from '@/types'

interface AuthCtxValue {
  user: User | null
  session: Session | null
  userRole: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => void
  isAdmin: boolean
  isAthleticDirector: boolean
  isCoach: boolean
  canManage: boolean
}

const AuthCtx = createContext<AuthCtxValue | null>(null)

async function loadUserRole(userId: string): Promise<UserRole | null> {
  const sb = createClient()
  const { data } = await sb
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data ?? null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const role = await loadUserRole(session.user.id)
        setUserRole(role)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const role = await loadUserRole(session.user.id)
        setUserRole(role)
      } else {
        setUserRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const sb = createClient()
    const { error } = await sb.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  function signOut() {
    createClient().auth.signOut()
  }

  const role = userRole?.role as AppRole | undefined
  const isAdmin = role === 'admin'
  const isAthleticDirector = role === 'athletic_director'
  const isCoach = role === 'coach'
  const canManage = isAdmin || isAthleticDirector

  return (
    <AuthCtx.Provider
      value={{
        user,
        session,
        userRole,
        loading,
        signIn,
        signOut,
        isAdmin,
        isAthleticDirector,
        isCoach,
        canManage,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
