/**
 * LeagueOps — Player Eligibility Engine
 *
 * Enforces:
 *   1. No play-down: A player's registered division sets the floor.
 *      They can play up but never down.
 *   2. Multi-game approval: Playing a 2nd+ game in a day requires
 *      approval from the opposing team's coach (or a ref/volunteer).
 */

import { createClient } from '@/supabase/client'

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: 'play_down'; playerDiv: string; gameDiv: string; message: string }
  | { eligible: false; reason: 'max_games'; gamesPlayed: number; max: number; message: string }
  | { eligible: 'pending_approval'; approvalId: number; message: string; firstGameId: number; opposingTeamName: string }

// ─── Division rank map ────────────────────────────────────────
const AGE_RANK: Record<string, number> = {
  '8U': 1, '10U': 2, '12U': 3, '14U': 4, '16U': 5, '18U': 6, 'Open': 99
}

function getAgeRank(division: string): number {
  const match = division.match(/(\d+U|Open)/i)
  if (!match) return 0
  return AGE_RANK[match[1].toUpperCase()] ?? 0
}

function getGender(division: string): string {
  if (division.toLowerCase().includes('girl')) return 'Girls'
  if (division.toLowerCase().includes('boy'))  return 'Boys'
  return 'Co-Ed'
}

// ─── Main eligibility check ───────────────────────────────────
export async function checkPlayerEligibility(
  playerId: number,
  gameId: number,
  eventDateId: number
): Promise<EligibilityResult> {
  const sb = createClient()

  // Load game info
  const { data: game } = await sb
    .from('games')
    .select('id, division, event_id, event_date_id, home_team_id, away_team_id, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .eq('id', gameId)
    .single()

  if (!game) return { eligible: false, reason: 'play_down', playerDiv: '', gameDiv: '', message: 'Game not found' }

  // Load player + their team division
  const { data: player } = await sb
    .from('players')
    .select('id, name, home_division, team:teams(division)')
    .eq('id', playerId)
    .single()

  if (!player) return { eligible: false, reason: 'play_down', playerDiv: '', gameDiv: '', message: 'Player not found' }

  const playerDiv = (player as any).home_division
    || (Array.isArray((player as any).team) ? (player as any).team[0]?.division : (player as any).team?.division)
    || ''

  const gameDiv = (game as any).division ?? ''

  // Load rules
  const { data: rules } = await sb
    .from('event_rules')
    .select('rule_key, rule_value')
    .eq('event_id', (game as any).event_id)
    .in('rule_key', ['enforce_play_down', 'allow_play_up', 'multi_game_require_approval', 'multi_game_max_per_day', 'ref_can_approve_multi'])

  const ruleMap: Record<string, string> = {}
  for (const r of rules ?? []) ruleMap[(r as any).rule_key] = (r as any).rule_value

  const enforcePlayDown        = ruleMap['enforce_play_down'] !== 'false'
  const requireMultiApproval   = ruleMap['multi_game_require_approval'] !== 'false'
  const maxGames               = parseInt(ruleMap['multi_game_max_per_day'] ?? '2')

  // ── Rule 1: Play-down check ───────────────────────────────
  if (enforcePlayDown && playerDiv && gameDiv) {
    const playerRank = getAgeRank(playerDiv)
    const gameRank   = getAgeRank(gameDiv)
    const playerGender = getGender(playerDiv)
    const gameGender   = getGender(gameDiv)

    // Same gender check (boys can't play in girls divisions and vice versa)
    // Cross-gender only allowed for Co-Ed
    if (playerGender !== gameGender && gameGender !== 'Co-Ed' && playerGender !== 'Co-Ed') {
      return {
        eligible: false,
        reason: 'play_down',
        playerDiv,
        gameDiv,
        message: `${player.name} is registered in ${playerDiv} and cannot play in a ${gameDiv} game (gender mismatch)`,
      }
    }

    // Age play-down check (same gender only)
    if (playerGender === gameGender && playerRank > 0 && gameRank > 0 && gameRank < playerRank) {
      await sb.from('eligibility_violations').insert({
        player_id:      playerId,
        game_id:        gameId,
        event_id:       (game as any).event_id,
        violation_type: 'play_down',
        player_division: playerDiv,
        game_division:   gameDiv,
        description:    `${player.name} (${playerDiv}) attempted to play down in ${gameDiv} game #${gameId}`,
        resolved:       false,
      })

      return {
        eligible: false,
        reason:    'play_down',
        playerDiv,
        gameDiv,
        message:  `${player.name} is registered in ${playerDiv} and cannot play down in a ${gameDiv} game`,
      }
    }
  }

  // ── Rule 2: Multi-game check ──────────────────────────────
  // Count games already checked into today
  const { data: todayCheckins } = await sb
    .from('player_checkins')
    .select('game_id, game:games!inner(event_date_id)')
    .eq('player_id', playerId)
    .neq('game_id', gameId)

  // Filter to same event date
  const sameDayCheckins = (todayCheckins ?? []).filter(
    (c: any) => {
      const gEDI = Array.isArray(c.game) ? c.game[0]?.event_date_id : c.game?.event_date_id
      return gEDI === eventDateId
    }
  )

  const gamesPlayedToday = sameDayCheckins.length

  // Check if already has a pending/approved multi-game request for THIS game
  const { data: existingApproval } = await sb
    .from('multi_game_approvals')
    .select('id, status')
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .single()

  if (existingApproval) {
    if ((existingApproval as any).status === 'approved') return { eligible: true }
    if ((existingApproval as any).status === 'denied') {
      return {
        eligible: false,
        reason:  'play_down',
        playerDiv,
        gameDiv,
        message: `Multi-game request for ${player.name} was denied by the opposing coach`,
      }
    }
    // Still pending
    return {
      eligible: 'pending_approval',
      approvalId: (existingApproval as any).id,
      message:   `Waiting for opposing coach approval`,
      firstGameId: sameDayCheckins[0] ? Number((sameDayCheckins[0] as any).game_id) : 0,
      opposingTeamName: 'opposing team',
    }
  }

  // Hard max exceeded
  if (maxGames > 0 && gamesPlayedToday >= maxGames && requireMultiApproval) {
    // Would exceed max — create approval request
  }

  // Multi-game — need approval if this is 2nd+ game
  if (gamesPlayedToday >= 1 && requireMultiApproval) {
    // Determine opposing team (the team that's NOT the player's team)
    const playerTeamId = (player as any).team_id
    const opposingTeamId = (game as any).home_team_id === playerTeamId
      ? (game as any).away_team_id
      : (game as any).home_team_id
    const opposingTeam = (game as any).home_team_id === playerTeamId
      ? (game as any).away_team
      : (game as any).home_team
    const opposingTeamName = Array.isArray(opposingTeam)
      ? opposingTeam[0]?.name ?? 'Opposing Team'
      : opposingTeam?.name ?? 'Opposing Team'

    // Create approval request
    const { data: approval } = await sb.from('multi_game_approvals').insert({
      player_id:          playerId,
      game_id:            gameId,
      first_game_id:      sameDayCheckins[0] ? Number((sameDayCheckins[0] as any).game_id) : null,
      event_id:           (game as any).event_id,
      event_date_id:      eventDateId,
      opposing_team_id:   opposingTeamId,
      opposing_team_name: opposingTeamName,
      status:             'pending',
      checkin_held:       true,
    }).select().single()

    await sb.from('eligibility_violations').insert({
      player_id:      playerId,
      game_id:        gameId,
      event_id:       (game as any).event_id,
      violation_type: 'multi_game_pending',
      player_division: playerDiv,
      game_division:   gameDiv,
      description:    `${player.name} playing ${gamesPlayedToday + 1} games today — opposing coach approval needed`,
    })

    await sb.from('ops_log').insert({
      event_id:    (game as any).event_id,
      message:     `Multi-game approval requested: ${player.name} game #${gameId} — opposing team: ${opposingTeamName}`,
      log_type:    'warn',
      occurred_at: new Date().toISOString(),
    })

    return {
      eligible:           'pending_approval',
      approvalId:         (approval as any).id,
      message:            `${player.name} has already played today. Awaiting ${opposingTeamName} approval.`,
      firstGameId:        sameDayCheckins[0] ? Number((sameDayCheckins[0] as any).game_id) : 0,
      opposingTeamName,
    }
  }

  return { eligible: true }
}

// ─── Approve a multi-game request ────────────────────────────
export async function approveMultiGame(
  approvalId: number,
  approvedBy: 'coach' | 'referee' | 'volunteer' | 'admin',
  approvedByName: string
): Promise<void> {
  const sb = createClient()

  // Update approval record
  const { data: approval } = await sb
    .from('multi_game_approvals')
    .update({
      status:          'approved',
      approved_by:     approvedBy,
      approved_by_name: approvedByName,
      approved_at:     new Date().toISOString(),
      checkin_held:    false,
    })
    .eq('id', approvalId)
    .select()
    .single()

  if (!approval) return

  // Complete the player check-in that was held
  await sb.from('player_checkins').upsert({
    game_id:       (approval as any).game_id,
    player_id:     (approval as any).player_id,
    checked_in_at: new Date().toISOString(),
  })

  // Resolve the eligibility violation
  await sb.from('eligibility_violations')
    .update({ resolved: true })
    .eq('player_id', (approval as any).player_id)
    .eq('game_id', (approval as any).game_id)
    .eq('violation_type', 'multi_game_pending')

  await sb.from('ops_log').insert({
    event_id:    (approval as any).event_id,
    message:     `Multi-game approved by ${approvedBy} (${approvedByName}) for player in game #${(approval as any).game_id}`,
    log_type:    'ok',
    occurred_at: new Date().toISOString(),
  })
}

// ─── Deny a multi-game request ────────────────────────────────
export async function denyMultiGame(
  approvalId: number,
  deniedBy: string,
  reason: string
): Promise<void> {
  const sb = createClient()
  const { data: approval } = await sb
    .from('multi_game_approvals')
    .update({ status: 'denied', denial_reason: reason, approved_by_name: deniedBy })
    .eq('id', approvalId)
    .select()
    .single()

  if (!approval) return

  await sb.from('eligibility_violations')
    .update({ resolved: true })
    .eq('player_id', (approval as any).player_id)
    .eq('game_id', (approval as any).game_id)
    .eq('violation_type', 'multi_game_pending')

  await sb.from('ops_log').insert({
    event_id:    (approval as any).event_id,
    message:     `Multi-game DENIED by ${deniedBy}: ${reason}`,
    log_type:    'warn',
    occurred_at: new Date().toISOString(),
  })
}

// ─── Load pending approvals for a game ───────────────────────
export async function getPendingApprovals(gameId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('multi_game_approvals')
    .select(`
      id, player_id, game_id, first_game_id, opposing_team_name,
      status, created_at, checkin_held,
      player:players(id, name, number)
    `)
    .eq('game_id', gameId)
    .eq('status', 'pending')
    .order('created_at')
  return data ?? []
}

// ─── Load all open approvals for an event ────────────────────
export async function getAllPendingApprovals(eventId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('multi_game_approvals')
    .select(`
      id, player_id, game_id, first_game_id, opposing_team_name,
      status, created_at, event_date_id,
      player:players(id, name, number, team:teams(name, division))
    `)
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .order('created_at')
  return data ?? []
}
