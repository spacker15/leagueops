import { NextRequest, NextResponse } from 'next/server'
import {
  checkPlayerEligibility,
  approveMultiGame,
  denyMultiGame,
  getPendingApprovals,
  getAllPendingApprovals,
} from '@/lib/engines/eligibility'
import { createClient } from '@/supabase/server'

// GET — load pending approvals
export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  const eventId = searchParams.get('event_id')
  const allPending = searchParams.get('all')

  try {
    if (allPending) {
      if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
      const data = await getAllPendingApprovals(Number(eventId), sb)
      return NextResponse.json(data)
    }
    if (gameId) {
      const data = await getPendingApprovals(Number(gameId), sb)
      return NextResponse.json(data)
    }
    if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
    return NextResponse.json([])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — check eligibility or approve/deny
export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { action } = body

  try {
    if (action === 'check') {
      const { player_id, game_id, event_date_id } = body
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
        sb
      )
      return NextResponse.json(result)
    }

    if (action === 'approve') {
      const { approval_id, approved_by, approved_by_name } = body
      if (!approval_id || !approved_by || !approved_by_name) {
        return NextResponse.json(
          { error: 'approval_id, approved_by, approved_by_name required' },
          { status: 400 }
        )
      }
      await approveMultiGame(Number(approval_id), approved_by, approved_by_name, sb)
      return NextResponse.json({ approved: true })
    }

    if (action === 'deny') {
      const { approval_id, denied_by, reason } = body
      if (!approval_id) {
        return NextResponse.json({ error: 'approval_id required' }, { status: 400 })
      }
      await denyMultiGame(Number(approval_id), denied_by ?? 'operator', reason ?? 'Denied by coach', sb)
      return NextResponse.json({ denied: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
