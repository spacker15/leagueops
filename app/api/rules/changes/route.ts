import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id') ?? '1'
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const { data, error } = await sb
    .from('rule_changes')
    .select('*, rule:event_rules(category, rule_label)')
    .eq('event_id', eventId)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
