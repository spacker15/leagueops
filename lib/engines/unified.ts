/**
 * LeagueOps Phase 5 — Unified Operations Engine
 *
 * Runs referee, field, and weather engines simultaneously.
 * Merges results into prioritized ops_alerts with auto-resolution suggestions.
 * Escalates unresolved alerts that exceed their threshold.
 */

import { createClient } from '@/supabase/client'

export interface OpsAlert {
  id: number
  source: string
  severity: 'info' | 'warning' | 'critical' | 'resolved'
  alert_type: string
  title: string
  description: string | null
  game_id: number | null
  field_id: number | null
  referee_id: number | null
  resolution_suggestion: string | null
  resolution_action: string | null
  resolution_params: Record<string, any> | null
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
  escalated_at: string | null
  escalation_threshold_minutes: number
}

export interface UnifiedRunResult {
  alerts_created: number
  alerts_escalated: number
  referee_conflicts: number
  field_conflicts: number
  weather_alerts: number
  run_at: string
}

// ─── Run all engines ──────────────────────────────────────────
export async function runUnifiedEngine(eventDateId: number): Promise<UnifiedRunResult> {
  const sb     = createClient()
  const runAt  = new Date().toISOString()
  let created  = 0
  let escalated = 0
  let refConflicts = 0
  let fieldConflicts = 0
  let weatherAlerts  = 0

  // Run in parallel
  const [refResult, fieldResult, weatherResult] = await Promise.allSettled([
    fetch('/api/referee-engine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date_id: eventDateId }),
    }).then(r => r.json()),
    fetch('/api/field-engine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date_id: eventDateId }),
    }).then(r => r.json()),
    fetch('/api/weather-engine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complex_id: 1 }),
    }).then(r => r.json()),
  ])

  // ── Process referee conflicts ──────────────────────────────
  if (refResult.status === 'fulfilled' && refResult.value?.conflicts) {
    for (const c of refResult.value.conflicts) {
      refConflicts++
      const alert = buildRefAlert(c, eventDateId)
      const { error } = await sb.from('ops_alerts').insert(alert)
      if (!error) created++
    }
  }

  // ── Process field conflicts ────────────────────────────────
  if (fieldResult.status === 'fulfilled' && fieldResult.value?.conflicts) {
    for (const c of fieldResult.value.conflicts) {
      fieldConflicts++
      const alert = buildFieldAlert(c, eventDateId)
      const { error } = await sb.from('ops_alerts').insert(alert)
      if (!error) created++
    }
  }

  // ── Process weather ────────────────────────────────────────
  if (weatherResult.status === 'fulfilled' && weatherResult.value) {
    const w = weatherResult.value
    if (w.lightning_active) {
      weatherAlerts++
      await sb.from('ops_alerts').insert({
        event_id: 1, event_date_id: eventDateId,
        source: 'weather_engine', severity: 'critical',
        alert_type: 'lightning',
        title: 'LIGHTNING — All games suspended',
        description: 'Lightning detected within 8 miles. All games must be suspended immediately.',
        resolution_suggestion: 'Lift suspension once 30-minute clear window has passed.',
        resolution_action: 'lift_lightning_suspension',
        resolved: false,
      })
      created++
    }
    if (w.heat_level === 'emergency') {
      weatherAlerts++
      await sb.from('ops_alerts').insert({
        event_id: 1, event_date_id: eventDateId,
        source: 'weather_engine', severity: 'critical',
        alert_type: 'heat_emergency',
        title: `Heat Emergency — ${w.heat_index ?? w.temperature}°F`,
        description: 'Heat index exceeds emergency threshold. Mandatory water breaks and game modifications required.',
        resolution_suggestion: 'Reduce game periods to 10 minutes, require 5-min water breaks every 15 min.',
        resolution_action: 'apply_heat_protocol',
        resolved: false,
      })
      created++
    }
  }

  // ── Escalate aging alerts ──────────────────────────────────
  const { data: unresolved } = await sb
    .from('ops_alerts')
    .select('id, created_at, escalation_threshold_minutes, severity')
    .eq('event_id', 1)
    .eq('resolved', false)
    .neq('severity', 'critical')
    .neq('severity', 'resolved')

  for (const alert of unresolved ?? []) {
    const ageMin = (Date.now() - new Date((alert as any).created_at).getTime()) / 60000
    if (ageMin >= ((alert as any).escalation_threshold_minutes ?? 15)) {
      await sb.from('ops_alerts').update({
        severity:     'critical',
        escalated_at: runAt,
      }).eq('id', (alert as any).id)
      escalated++
    }
  }

  // Log the run
  await sb.from('ops_log').insert({
    event_id:    1,
    message:     `Unified engine run: ${refConflicts} ref conflicts, ${fieldConflicts} field conflicts, ${weatherAlerts} weather alerts. ${created} new alerts, ${escalated} escalated.`,
    log_type:    created + escalated > 0 ? 'warn' : 'ok',
    source:      'unified_engine',
    occurred_at: runAt,
  })

  return {
    alerts_created:   created,
    alerts_escalated: escalated,
    referee_conflicts: refConflicts,
    field_conflicts:   fieldConflicts,
    weather_alerts:    weatherAlerts,
    run_at:            runAt,
  }
}

// ─── Resolve an alert with a specific action ─────────────────
export async function resolveAlert(
  alertId: number,
  resolvedBy: string,
  note?: string
): Promise<void> {
  const sb = createClient()

  // Get the alert
  const { data: alert } = await sb.from('ops_alerts').select('*').eq('id', alertId).single()
  if (!alert) return

  const a = alert as OpsAlert

  // Apply the resolution action if there is one
  if (a.resolution_action && a.resolution_params) {
    await applyResolutionAction(a.resolution_action, a.resolution_params)
  }

  // Mark resolved
  await sb.from('ops_alerts').update({
    resolved:       true,
    resolved_by:    resolvedBy,
    resolved_at:    new Date().toISOString(),
    resolution_note: note ?? a.resolution_suggestion ?? 'Resolved',
    severity:       'resolved',
  }).eq('id', alertId)

  await sb.from('ops_log').insert({
    event_id:    1,
    message:     `Alert resolved by ${resolvedBy}: ${a.title}`,
    log_type:    'ok',
    source:      'command_center',
    occurred_at: new Date().toISOString(),
  })
}

// ─── Apply a resolution action ────────────────────────────────
async function applyResolutionAction(action: string, params: Record<string, any>) {
  const sb = createClient()

  switch (action) {
    case 'delay_game': {
      const { game_id, minutes } = params
      if (game_id) {
        await sb.from('games').update({ status: 'Delayed' }).eq('id', game_id)
        await sb.from('ops_log').insert({
          event_id: 1, message: `Game #${game_id} delayed by ${minutes ?? '?'} minutes via auto-resolution`,
          log_type: 'warn', source: 'command_center', occurred_at: new Date().toISOString(),
        })
      }
      break
    }
    case 'swap_games': {
      const { game_a, game_b } = params
      if (game_a && game_b) {
        const [{ data: a }, { data: b }] = await Promise.all([
          sb.from('games').select('field_id, scheduled_time').eq('id', game_a).single(),
          sb.from('games').select('field_id, scheduled_time').eq('id', game_b).single(),
        ])
        if (a && b) {
          await Promise.all([
            sb.from('games').update({ field_id: (b as any).field_id, scheduled_time: (b as any).scheduled_time }).eq('id', game_a),
            sb.from('games').update({ field_id: (a as any).field_id, scheduled_time: (a as any).scheduled_time }).eq('id', game_b),
          ])
        }
      }
      break
    }
    case 'lift_lightning_suspension': {
      await sb.from('games').update({ status: 'Scheduled' }).eq('event_id', 1).eq('status', 'Suspended')
      break
    }
    // Other actions are informational only — resolved by manual action
  }
}

// ─── Generate shift handoff ───────────────────────────────────
export async function generateShiftHandoff(createdBy: string): Promise<string> {
  const sb  = createClient()
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  // Gather last-hour stats
  const [
    { data: recentLogs },
    { data: recentAlerts },
    { data: liveGames },
    { data: recentCheckins },
    { data: recentIncidents },
  ] = await Promise.all([
    sb.from('ops_log').select('*').gte('occurred_at', hourAgo.toISOString()).order('occurred_at', { ascending: false }).limit(50),
    sb.from('ops_alerts').select('*').gte('created_at', hourAgo.toISOString()),
    sb.from('games').select('id, status, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name), field:fields(name)').in('status', ['Live', 'Halftime']),
    sb.from('player_checkins').select('id').gte('checked_in_at', hourAgo.toISOString()),
    sb.from('incidents').select('*').gte('created_at', hourAgo.toISOString()),
  ])

  const logs      = recentLogs ?? []
  const alerts    = recentAlerts ?? []
  const games     = liveGames ?? []
  const checkins  = recentCheckins ?? []
  const incidents = recentIncidents ?? []

  const openAlerts    = alerts.filter((a: any) => !a.resolved)
  const resolvedAlerts = alerts.filter((a: any) => a.resolved)
  const criticals      = openAlerts.filter((a: any) => a.severity === 'critical')

  const lines: string[] = [
    `# Shift Handoff — ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
    `Generated by: ${createdBy}`,
    '',
    '## Current Status',
    `- **Live games:** ${games.length}`,
    `- **Open alerts:** ${openAlerts.length} (${criticals.length} critical)`,
    `- **Check-ins (last hour):** ${checkins.length}`,
    `- **Incidents (last hour):** ${incidents.length}`,
    '',
  ]

  if (games.length > 0) {
    lines.push('## Games In Progress')
    for (const g of games) {
      lines.push(`- Field ${(g as any).field?.name}: ${(g as any).home_team?.name} vs ${(g as any).away_team?.name} [${(g as any).status}]`)
    }
    lines.push('')
  }

  if (criticals.length > 0) {
    lines.push('## ⚠️ Critical Alerts Needing Attention')
    for (const a of criticals) {
      lines.push(`- **${(a as any).title}** — ${(a as any).description ?? ''}`)
      if ((a as any).resolution_suggestion) lines.push(`  → Recommended: ${(a as any).resolution_suggestion}`)
    }
    lines.push('')
  }

  if (incidents.length > 0) {
    lines.push('## Incidents (Last Hour)')
    for (const inc of incidents) {
      lines.push(`- ${(inc as any).incident_type ?? 'Incident'}: ${(inc as any).description ?? ''} — ${(inc as any).field_name ?? ''}`)
    }
    lines.push('')
  }

  if (resolvedAlerts.length > 0) {
    lines.push(`## Resolved This Hour (${resolvedAlerts.length})`)
    for (const a of resolvedAlerts.slice(0, 5)) {
      lines.push(`- ~~${(a as any).title}~~ resolved by ${(a as any).resolved_by ?? 'system'}`)
    }
    lines.push('')
  }

  if (logs.length > 0) {
    lines.push('## Recent Activity (Last 10 entries)')
    for (const log of logs.slice(0, 10)) {
      const time = new Date((log as any).occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      lines.push(`- ${time} — ${(log as any).message}`)
    }
  }

  const summary = lines.join('\n')

  // Save handoff
  await sb.from('shift_handoffs').insert({
    event_id:     1,
    created_by:   createdBy,
    summary,
    period_start: hourAgo.toISOString(),
    period_end:   now.toISOString(),
    stats: {
      live_games:       games.length,
      open_alerts:      openAlerts.length,
      critical_alerts:  criticals.length,
      checkins:         checkins.length,
      incidents:        incidents.length,
    },
  })

  return summary
}

// ─── Alert builders ───────────────────────────────────────────
function buildRefAlert(conflict: any, eventDateId: number): any {
  const base = {
    event_id: 1, event_date_id: eventDateId, source: 'referee_engine',
    resolved: false, escalation_threshold_minutes: 15,
  }

  switch (conflict.type) {
    case 'missing_referee':
      return {
        ...base, severity: 'warning', alert_type: 'missing_referee',
        game_id: conflict.game_id, field_id: conflict.field_id,
        title:   `Missing referee — Game #${conflict.game_id}`,
        description: `${conflict.description ?? 'No referee assigned'}`,
        resolution_suggestion: 'Assign an available referee from the Refs & Vols tab, or reassign from an upcoming game.',
        resolution_action: null,
        resolution_params: null,
      }
    case 'ref_double_booked':
      return {
        ...base, severity: 'warning', alert_type: 'ref_double_booked',
        game_id: conflict.game_id, referee_id: conflict.referee_id,
        title:   `Ref double-booked — ${conflict.referee_name ?? `Ref #${conflict.referee_id}`}`,
        description: conflict.description ?? 'Referee assigned to overlapping games',
        resolution_suggestion: 'Remove this referee from one game and assign a replacement.',
        resolution_action: null,
        resolution_params: null,
      }
    default:
      return {
        ...base, severity: 'warning', alert_type: conflict.type ?? 'ref_conflict',
        game_id: conflict.game_id,
        title:   conflict.description ?? 'Referee conflict',
        description: null,
        resolution_suggestion: 'Review Refs & Vols tab for details.',
        resolution_action: null, resolution_params: null,
      }
  }
}

function buildFieldAlert(conflict: any, eventDateId: number): any {
  const base = {
    event_id: 1, event_date_id: eventDateId, source: 'field_engine',
    resolved: false, escalation_threshold_minutes: 20,
  }

  const suggestDelay = conflict.game_id
    ? `Delay Game #${conflict.game_id} by 20 minutes to clear the overlap.`
    : 'Review schedule for field conflicts.'

  switch (conflict.conflict_type ?? conflict.type) {
    case 'field_overlap':
      return {
        ...base, severity: 'critical', alert_type: 'field_overlap',
        game_id: conflict.game_id, field_id: conflict.field_id,
        title:   `Field overlap — ${conflict.field_name ?? `Field #${conflict.field_id}`}`,
        description: conflict.description ?? 'Two games scheduled on the same field at the same time',
        resolution_suggestion: suggestDelay,
        resolution_action: 'delay_game',
        resolution_params: { game_id: conflict.game_id, minutes: 20 },
      }
    case 'field_blocked':
      return {
        ...base, severity: 'warning', alert_type: 'field_blocked',
        game_id: conflict.game_id, field_id: conflict.field_id,
        title:   `Field blocked — Game #${conflict.game_id}`,
        description: conflict.description ?? 'Field has a block during game time',
        resolution_suggestion: 'Move game to an available field or remove the field block.',
        resolution_action: null, resolution_params: null,
      }
    default:
      return {
        ...base, severity: 'warning', alert_type: 'field_conflict',
        game_id: conflict.game_id,
        title:   conflict.description ?? 'Field scheduling conflict',
        description: null,
        resolution_suggestion: 'Review Conflicts tab for details.',
        resolution_action: null, resolution_params: null,
      }
  }
}
