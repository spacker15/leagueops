import { NextRequest, NextResponse } from 'next/server'
import {
  checkPlayerEligibility,
  approveMultiGame,
  denyMultiGame,
  getPendingApprovals,
  getAllPendingApprovals,
} from '@/lib/engines/eligibility'
import { createClient } from '@/lib/supabase/server'

// GET — load pending approvals
export async function GET(req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  const eventId = searchParams.get('event_id')
  const allPending = searchParams.get('all')

  try {
    if (allPending) {
      if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
      const data = await getAllPendingApprovals(Number(eventId), supabase)
      return NextResponse.json(data)
    }
    if (gameId) {
      const data = await getPendingApprovals(Number(gameId), supabase)
      return NextResponse.json(data)
    }
    if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
    return NextResponse.json([])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST — check eligibility or approve/deny
export async function POST(req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse raw JSON body (SEC-07)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Business logic — eligibility uses a discriminated action pattern; body is validated inline
  const parsed = body as Record<string, unknown>
  const { action } = parsed

  try {
    if (action === 'check') {
      const { player_id, game_id, event_date_id } = parsed
      if (!player_id || !game_id || !event_date_id) {
        return NextResponse.json(
          { error: 'player_id, game_id, event_date_id required' },
          { status: 400 }
        )
      }
      const result = await checkPlayerEligibility(
        Number(player_id),
        Number(game_id),
        Number(event_date_id),
        supabase
      )
      return NextResponse.json(result)
    }

    if (action === 'approve') {
      const { approval_id, approved_by, approved_by_name } = parsed
      if (!approval_id || !approved_by || !approved_by_name) {
        return NextResponse.json(
          { error: 'approval_id, approved_by, approved_by_name required' },
          { status: 400 }
        )
      }
      await approveMultiGame(
        Number(approval_id),
        String(approved_by) as 'admin' | 'referee' | 'volunteer' | 'coach',
        String(approved_by_name),
        supabase
      )
      return NextResponse.json({ approved: true })
    }

    if (action === 'deny') {
      const { approval_id, denied_by, reason } = parsed
      if (!approval_id) {
        return NextResponse.json({ error: 'approval_id required' }, { status: 400 })
      }
      await denyMultiGame(
        Number(approval_id),
        denied_by ? String(denied_by) : 'operator',
        reason ? String(reason) : 'Denied by coach',
        supabase
      )
      return NextResponse.json({ denied: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
