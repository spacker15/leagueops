import { NextRequest, NextResponse } from 'next/server'
import { generateSchedule, detectConflicts } from '@/lib/engines/schedule'
import { validateSchedule } from '@/lib/engines/schedule-validator'
import { createClient } from '@/supabase/server'

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { event_id, dry_run = false } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const result = await generateSchedule(Number(event_id), sb)

    if (result.games.length === 0) {
      return NextResponse.json({ error: 'No games generated' }, { status: 400 })
    }

    // Run validation on generated games
    const validation = await validateSchedule(Number(event_id), result.games, sb)

    if (dry_run) {
      // Dry run: return validation results without inserting games
      return NextResponse.json({
        success: true,
        dryRun: true,
        gamesCreated: 0,
        validation,
        auditRunId: '',
        totalMatchups: result.totalMatchups,
        teamCount: result.teamCount,
        fieldCount: result.fieldCount,
        dateCount: result.dateCount,
        divisionCount: result.divisionCount,
      })
    }

    // Insert games
    const { data: inserted, error: insertErr } = await sb
      .from('games')
      .insert(result.games)
      .select('id')

    if (insertErr) {
      return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 })
    }

    // Create audit run entry
    const { data: auditRun } = await sb
      .from('schedule_audit_log')
      .insert({
        event_id: Number(event_id),
        run_type: 'generate',
        games_created: inserted?.length ?? result.games.length,
        validation_errors: validation.errors.length,
        validation_warnings: validation.warnings.length,
        summary: validation.summary,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    await sb.from('ops_log').insert({
      event_id: Number(event_id),
      message: `Schedule generated: ${result.games.length} games across ${result.divisionCount} divisions, ${result.fieldCount} fields, ${result.dateCount} dates`,
      log_type: 'ok',
      occurred_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      dryRun: false,
      gamesCreated: inserted?.length ?? result.games.length,
      validation,
      auditRunId: auditRun?.id ?? '',
      totalMatchups: result.totalMatchups,
      teamCount: result.teamCount,
      fieldCount: result.fieldCount,
      dateCount: result.dateCount,
      divisionCount: result.divisionCount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const result = await detectConflicts(Number(eventId), sb)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
