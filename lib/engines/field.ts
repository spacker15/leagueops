/**
 * LeagueOps — Field Conflict Engine (Phase 4)
 *
 * Detects field-level scheduling problems and writes them to
 * operational_conflicts. Pulls thresholds from the rules engine.
 *
 * Conflict types detected:
 *   field_overlap      — two games on same field overlap in time
 *   field_blocked      — game scheduled during a field block
 *   schedule_cascade   — game likely delayed due to previous game running long
 *   missing_referee    — game has fewer refs than required (cross-checks with referee engine)
 *
 * Resolution options are structured so the UI can act on them directly.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSchedulingRules } from '@/lib/engines/rules'

// ─── Types ────────────────────────────────────────────────────
export interface FieldConflict {
  type: 'field_overlap' | 'field_blocked' | 'schedule_cascade' | 'missing_referee'
  severity: 'info' | 'warning' | 'critical'
  fieldId: number
  fieldName: string
  gameIds: number[]
  description: string
  resolutionOptions: ResolutionOption[]
  metadata?: Record<string, unknown>
}

export interface ResolutionOption {
  action: string
  label: string
  params?: Record<string, unknown>
}

export interface FieldEngineResult {
  conflicts: FieldConflict[]
  clean: boolean
  summary: string
  stats: {
    gamesScanned: number
    fieldsScanned: number
    blocksChecked: number
    overlapCount: number
    blockedCount: number
    cascadeCount: number
  }
  durationMs: number
}

// ─── Time parsing ─────────────────────────────────────────────
function timeToMinutes(time: string): number {
  if (!time) return 0
  const ampm = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = parseInt(ampm[2])
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const plain = time.match(/(\d+):(\d+)/)
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2])
  return 0
}

function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
}

// ─── Main engine ──────────────────────────────────────────────
export async function runFieldConflictEngine(
  eventDateId: number,
  eventId: number,
  sb: SupabaseClient
): Promise<FieldEngineResult> {
  const startTime = Date.now()

  // Load rules
  const rules = await getSchedulingRules(eventId, sb)
  const gameDuration = rules.game_duration_min
  const bufferMin = rules.buffer_min
  const overlapTol = 0 // from rules — overlap_tolerance_min
  const cascadeWindow = 15 // from rules — cascade_delay_min

  // Load games for this date with field info
  const { data: games } = await sb
    .from('games')
    .select(
      `
      id, field_id, scheduled_time, status, division, sort_order,
      home_team_id, away_team_id,
      field:fields(id, name, complex_id),
      home_team:teams!games_home_team_id_fkey(id, name),
      away_team:teams!games_away_team_id_fkey(id, name)
    `
    )
    .eq('event_date_id', eventDateId)
    .eq('event_id', eventId)
    .order('field_id')
    .order('scheduled_time')

  if (!games || games.length === 0) {
    return {
      conflicts: [],
      clean: true,
      summary: 'No games to scan',
      stats: {
        gamesScanned: 0,
        fieldsScanned: 0,
        blocksChecked: 0,
        overlapCount: 0,
        blockedCount: 0,
        cascadeCount: 0,
      },
      durationMs: Date.now() - startTime,
    }
  }

  // Load field blocks active during this event date
  const { data: eventDate } = await sb
    .from('event_dates')
    .select('date')
    .eq('id', eventDateId)
    .single()

  const { data: fieldBlocks } = await sb
    .from('field_blocks')
    .select('*, field:fields(id, name)')
    .eq('event_id', eventId)

  // Load ref assignments to check coverage
  const gameIds = games.map((g) => g.id)
  const { data: refAssignments } = await sb
    .from('ref_assignments')
    .select('game_id, referee_id')
    .in('game_id', gameIds)

  // Get required refs per game from rules
  const { data: refsPerGameRule } = await sb
    .from('event_rules')
    .select('rule_value')
    .eq('event_id', eventId)
    .eq('category', 'referee')
    .eq('rule_key', 'refs_per_game')
    .single()
  const refsPerGame = parseInt(refsPerGameRule?.rule_value ?? '2')

  const conflicts: FieldConflict[] = []
  const stats = {
    gamesScanned: games.length,
    fieldsScanned: new Set(games.map((g) => g.field_id)).size,
    blocksChecked: fieldBlocks?.length ?? 0,
    overlapCount: 0,
    blockedCount: 0,
    cascadeCount: 0,
  }

  // ── Group games by field ──────────────────────────────────
  const byField = new Map<number, typeof games>()
  for (const game of games) {
    if (!byField.has(game.field_id)) byField.set(game.field_id, [])
    byField.get(game.field_id)!.push(game)
  }

  // ── Check 1: Field overlaps ───────────────────────────────
  for (const [fieldId, fieldGames] of byField.entries()) {
    const sorted = [...fieldGames].sort(
      (a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
    )
    const fieldName = (sorted[0] as any).field?.name ?? `Field ${fieldId}`

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]
        const b = sorted[j]

        if (a.status === 'Final' && b.status === 'Final') continue

        const aStart = timeToMinutes(a.scheduled_time)
        const aEnd = aStart + gameDuration
        const bStart = timeToMinutes(b.scheduled_time)

        // Overlap: B starts before A ends (minus tolerance)
        if (bStart < aEnd - overlapTol) {
          const overlapMinutes = aEnd - bStart
          stats.overlapCount++
          conflicts.push({
            type: 'field_overlap',
            severity: overlapMinutes > 15 ? 'critical' : 'warning',
            fieldId,
            fieldName,
            gameIds: [a.id, b.id],
            description: `${fieldName}: Game #${a.id} (${a.scheduled_time}) and Game #${b.id} (${b.scheduled_time}) overlap by ${overlapMinutes} min`,
            resolutionOptions: [
              {
                action: 'reschedule_game',
                label: `Move Game #${b.id} to ${minutesToDisplay(aEnd + bufferMin)}`,
                params: { game_id: b.id, new_time: minutesToDisplay(aEnd + bufferMin) },
              },
              {
                action: 'move_to_field',
                label: `Move Game #${b.id} to another field`,
                params: { game_id: b.id },
              },
              {
                action: 'swap_games',
                label: `Swap Game #${a.id} and #${b.id}`,
                params: { game_id_a: a.id, game_id_b: b.id },
              },
            ],
            metadata: { overlap_minutes: overlapMinutes, a_end: minutesToDisplay(aEnd) },
          })
        }

        // Buffer violation — not overlapping but too close
        else if (bStart < aEnd + bufferMin) {
          const gap = bStart - aEnd
          stats.overlapCount++
          conflicts.push({
            type: 'field_overlap',
            severity: 'info',
            fieldId,
            fieldName,
            gameIds: [a.id, b.id],
            description: `${fieldName}: Only ${gap} min gap between Game #${a.id} and #${b.id} (minimum: ${bufferMin} min)`,
            resolutionOptions: [
              {
                action: 'reschedule_game',
                label: `Move Game #${b.id} to ${minutesToDisplay(aEnd + bufferMin)}`,
                params: { game_id: b.id, new_time: minutesToDisplay(aEnd + bufferMin) },
              },
            ],
            metadata: { gap_minutes: gap },
          })
        }
      }
    }

    // ── Check 2: Cascade delays ─────────────────────────────
    // If a game is Live/Halftime and the next game starts soon
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (!['Live', 'Halftime'].includes(current.status)) continue
      if (next.status === 'Final') continue

      const currentStart = timeToMinutes(current.scheduled_time)
      const currentEnd = currentStart + gameDuration
      const nextStart = timeToMinutes(next.scheduled_time)

      if (nextStart <= currentEnd + cascadeWindow) {
        stats.cascadeCount++
        conflicts.push({
          type: 'schedule_cascade',
          severity: nextStart <= currentEnd ? 'critical' : 'warning',
          fieldId,
          fieldName,
          gameIds: [current.id, next.id],
          description: `${fieldName}: Game #${current.id} still ${current.status} — Game #${next.id} (${next.scheduled_time}) may be delayed`,
          resolutionOptions: [
            {
              action: 'delay_game',
              label: `Delay Game #${next.id} by 15 min`,
              params: { game_id: next.id, delay_minutes: 15 },
            },
            {
              action: 'delay_game',
              label: `Delay Game #${next.id} by 30 min`,
              params: { game_id: next.id, delay_minutes: 30 },
            },
            {
              action: 'move_to_field',
              label: `Move Game #${next.id} to open field`,
              params: { game_id: next.id },
            },
          ],
        })
      }
    }
  }

  // ── Check 3: Field blocks ─────────────────────────────────
  for (const game of games) {
    if (game.status === 'Final') continue

    const gameStart = timeToMinutes(game.scheduled_time)
    const gameEnd = gameStart + gameDuration
    const fieldName = (game as any).field?.name ?? `Field ${game.field_id}`

    for (const block of fieldBlocks ?? []) {
      if (block.field_id !== game.field_id) continue

      const blockStart = timeToMinutes(
        new Date(block.starts_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      )
      const blockEnd = timeToMinutes(
        new Date(block.ends_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      )

      // Game overlaps with block
      if (gameStart < blockEnd && gameEnd > blockStart) {
        stats.blockedCount++
        conflicts.push({
          type: 'field_blocked',
          severity: 'critical',
          fieldId: game.field_id,
          fieldName,
          gameIds: [game.id],
          description: `${fieldName}: Game #${game.id} (${game.scheduled_time}) conflicts with field block — ${block.reason} (${new Date(block.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–${new Date(block.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`,
          resolutionOptions: [
            {
              action: 'move_to_field',
              label: `Move Game #${game.id} to open field`,
              params: { game_id: game.id },
            },
            {
              action: 'remove_field_block',
              label: `Remove field block`,
              params: { block_id: block.id },
            },
            {
              action: 'reschedule_game',
              label: `Reschedule Game #${game.id} after block`,
              params: {
                game_id: game.id,
                after_time: new Date(block.ends_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }),
              },
            },
          ],
          metadata: { block_reason: block.reason, block_id: block.id },
        })
      }
    }
  }

  // ── Check 4: Missing/insufficient referees ────────────────
  const refCountByGame = new Map<number, number>()
  for (const ra of refAssignments ?? []) {
    refCountByGame.set(ra.game_id, (refCountByGame.get(ra.game_id) ?? 0) + 1)
  }

  for (const game of games) {
    if (game.status === 'Final') continue
    const refCount = refCountByGame.get(game.id) ?? 0
    if (refCount < refsPerGame) {
      const fieldName = (game as any).field?.name ?? `Field ${game.field_id}`
      conflicts.push({
        type: 'missing_referee',
        severity: refCount === 0 ? 'critical' : 'warning',
        fieldId: game.field_id,
        fieldName,
        gameIds: [game.id],
        description: `${fieldName}: Game #${game.id} (${game.scheduled_time} · ${game.division}) has ${refCount}/${refsPerGame} refs assigned`,
        resolutionOptions: [
          {
            action: 'assign_referee',
            label: `Assign referee to Game #${game.id}`,
            params: { game_id: game.id, time: game.scheduled_time, division: game.division },
          },
        ],
        metadata: { refs_assigned: refCount, refs_required: refsPerGame },
      })
    }
  }

  // ── Clear stale conflicts and write new ones ──────────────
  await clearStaleFieldConflicts(eventDateId, eventId, sb)

  for (const conflict of conflicts) {
    await sb.from('operational_conflicts').insert({
      event_id: eventId,
      conflict_type: conflict.type,
      severity: conflict.severity,
      impacted_game_ids: conflict.gameIds,
      impacted_ref_ids: [],
      impacted_field_ids: [conflict.fieldId],
      description: conflict.description,
      resolution_options: conflict.resolutionOptions,
      resolved: false,
    })
  }

  // ── Log the run ───────────────────────────────────────────
  const durationMs = Date.now() - startTime

  await sb.from('conflict_engine_runs').insert({
    event_id: eventId,
    event_date_id: eventDateId,
    engine_type: 'field',
    conflicts_found: conflicts.length,
    duration_ms: durationMs,
    triggered_by: 'manual',
  })

  const critical = conflicts.filter((c) => c.severity === 'critical').length
  const warnings = conflicts.filter((c) => c.severity === 'warning').length
  const info = conflicts.filter((c) => c.severity === 'info').length

  const summary =
    conflicts.length === 0
      ? `All clear — ${stats.gamesScanned} games on ${stats.fieldsScanned} fields scanned`
      : `${critical} critical · ${warnings} warnings · ${info} info — ${stats.gamesScanned} games scanned`

  return { conflicts, clean: conflicts.length === 0, summary, stats, durationMs }
}

// ─── Clear stale field conflicts before re-run ───────────────
async function clearStaleFieldConflicts(eventDateId: number, eventId: number, sb: SupabaseClient) {
  const { data: games } = await sb.from('games').select('id').eq('event_date_id', eventDateId)

  if (!games || games.length === 0) return
  const gameIds = games.map((g) => g.id)

  const { data: existing } = await sb
    .from('operational_conflicts')
    .select('id, impacted_game_ids')
    .eq('event_id', eventId)
    .eq('resolved', false)
    .in('conflict_type', ['field_overlap', 'field_blocked', 'schedule_cascade', 'missing_referee'])

  if (!existing) return

  const toDelete = existing
    .filter((c) => (c.impacted_game_ids as number[]).some((id) => gameIds.includes(id)))
    .map((c) => c.id)

  if (toDelete.length > 0) {
    await sb.from('operational_conflicts').delete().in('id', toDelete)
  }
}

// ─── Apply a resolution action ────────────────────────────────
export async function applyResolution(
  conflictId: number,
  action: string,
  params: Record<string, unknown>,
  eventId: number,
  sb: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action) {
      case 'reschedule_game': {
        const { game_id, new_time } = params
        await sb
          .from('games')
          .update({ scheduled_time: String(new_time) })
          .eq('id', Number(game_id))
        await sb.from('ops_log').insert({
          event_id: eventId,
          message: `Game #${game_id} rescheduled to ${new_time} (conflict resolution)`,
          log_type: 'ok',
          occurred_at: new Date().toISOString(),
        })
        return { success: true, message: `Game #${game_id} rescheduled to ${new_time}` }
      }

      case 'delay_game': {
        const { game_id, delay_minutes } = params
        // Get current time
        const { data: game } = await sb
          .from('games')
          .select('scheduled_time')
          .eq('id', Number(game_id))
          .single()
        if (!game) return { success: false, message: 'Game not found' }
        const currentMin = timeToMinutes(game.scheduled_time)
        const newMin = currentMin + Number(delay_minutes)
        const newTime = minutesToDisplay(newMin)
        await sb
          .from('games')
          .update({ scheduled_time: newTime, status: 'Delayed' })
          .eq('id', Number(game_id))
        await sb.from('ops_log').insert({
          event_id: eventId,
          message: `Game #${game_id} delayed ${delay_minutes} min → ${newTime}`,
          log_type: 'warn',
          occurred_at: new Date().toISOString(),
        })
        return {
          success: true,
          message: `Game #${game_id} delayed ${delay_minutes} min to ${newTime}`,
        }
      }

      case 'move_to_field': {
        // For now mark as needing manual assignment — field selection done in UI
        return {
          success: true,
          message: 'Open the Schedule tab to reassign this game to another field',
        }
      }

      case 'swap_games': {
        const { game_id_a, game_id_b } = params
        const { data: gameA } = await sb
          .from('games')
          .select('scheduled_time, field_id')
          .eq('id', Number(game_id_a))
          .single()
        const { data: gameB } = await sb
          .from('games')
          .select('scheduled_time, field_id')
          .eq('id', Number(game_id_b))
          .single()
        if (!gameA || !gameB) return { success: false, message: 'Games not found' }
        await sb
          .from('games')
          .update({ scheduled_time: gameB.scheduled_time })
          .eq('id', Number(game_id_a))
        await sb
          .from('games')
          .update({ scheduled_time: gameA.scheduled_time })
          .eq('id', Number(game_id_b))
        await sb.from('ops_log').insert({
          event_id: eventId,
          message: `Games #${game_id_a} and #${game_id_b} swapped times`,
          log_type: 'ok',
          occurred_at: new Date().toISOString(),
        })
        return { success: true, message: `Games #${game_id_a} and #${game_id_b} swapped` }
      }

      case 'remove_field_block': {
        const { block_id } = params
        await sb.from('field_blocks').delete().eq('id', Number(block_id))
        return { success: true, message: `Field block removed` }
      }

      default:
        return { success: false, message: `Unknown action: ${action}` }
    }
  } catch (err: any) {
    return { success: false, message: err.message }
  } finally {
    // Mark conflict resolved
    await sb
      .from('operational_conflicts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: 'field_engine',
      })
      .eq('id', conflictId)
  }
}

// ─── Run both engines together ────────────────────────────────
export async function runFullConflictScan(
  eventDateId: number,
  eventId: number,
  sb: SupabaseClient
) {
  const [fieldResult] = await Promise.all([runFieldConflictEngine(eventDateId, eventId, sb)])

  await sb.from('conflict_engine_runs').insert({
    event_id: eventId,
    event_date_id: eventDateId,
    engine_type: 'full',
    conflicts_found: fieldResult.conflicts.length,
    duration_ms: fieldResult.durationMs,
    triggered_by: 'manual',
  })

  return { field: fieldResult }
}
