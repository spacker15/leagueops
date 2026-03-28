import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns existing program + team data for a logged-in user.
 * Used to prefill the registration form when they already have an account.
 */
export async function GET(_req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get their program via program_leaders
  const { data: leader } = await supabase
    .from('program_leaders')
    .select('program_id')
    .eq('user_id', user.id)
    .single()

  if (!leader) {
    return NextResponse.json({ program: null, teams: [] })
  }

  // Load program
  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', leader.program_id)
    .single()

  // Load their previous team registrations
  const { data: teams } = await supabase
    .from('team_registrations')
    .select('*')
    .eq('program_id', leader.program_id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ program, teams: teams ?? [] })
}
