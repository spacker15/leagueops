import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// GET: query schedule audit log
// Params: event_id (required), run_id (optional), team_id (optional), rule_id (optional), limit (default 100)
export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  const runId = searchParams.get('run_id')
  const teamId = searchParams.get('team_id')
  const ruleId = searchParams.get('rule_id')
  const limit = parseInt(searchParams.get('limit') ?? '100', 10)

  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  let query = sb
    .from('schedule_audit_log')
    .select('*')
    .eq('event_id', Number(eventId))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (runId) {
    query = query.eq('id', runId)
  }
  if (teamId) {
    query = query.contains('summary', { affected_team_ids: [Number(teamId)] })
  }
  if (ruleId) {
    query = query.contains('summary', { rule_id: Number(ruleId) })
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ audit: data })
}
