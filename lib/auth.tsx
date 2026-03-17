'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'league_admin' | 'referee' | 'volunteer' | 'player' | 'program_leader' | 'coach'

export interface UserRole {
  id: number
  role: AppRole
  event_id: number | null
  referee_id: number | null
  volunteer_id: number | null
  player_id: number | null
  program_id: number | null
  display_name: string | null
  is_active: boolean
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  userRole: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
  isLeagueAdmin: boolean
  isReferee: boolean
  isVolunteer: boolean
  canManage: boolean // admin or league_admin
}

const AuthCtx = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<User | null>(null)
  const [session, setSession]     = useState<Session | null>(null)
  const [userRole, setUserRole]   = useState<UserRole | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const sb = createClient()

    // Get initial session
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadUserRole(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadUserRole(session.user.id)
      else { setUserRole(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserRole(userId: string) {
    const sb = createClient()
    const { data } = await sb
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('id')
      .limit(1)
      .single()
    setUserRole(data as UserRole ?? null)
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const sb = createClient()
    const { error } = await sb.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    const sb = createClient()
    await sb.auth.signOut()
    setUserRole(null)
  }

  const isAdmin       = userRole?.role === 'admin'
  const isLeagueAdmin = userRole?.role === 'league_admin'
  const isReferee     = userRole?.role === 'referee'
  const isVolunteer   = userRole?.role === 'volunteer'
  const canManage     = isAdmin || isLeagueAdmin

  return (
    <AuthCtx.Provider value={{
      user, session, userRole, loading,
      signIn, signOut,
      isAdmin, isLeagueAdmin, isReferee, isVolunteer, canManage,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
