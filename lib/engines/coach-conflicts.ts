import type { SupabaseClient } from '@supabase/supabase-js'

export interface CoachConflictEntry {
  coach_id: number
  coach_email: string
  coach_name: string
  team_ids: number[]
  team_names: string[]
}

export interface CoachConflictResult {
  conflicts: CoachConflictEntry[]
  conflictingPairs: [number, number][]
  clean: boolean
}

export async function detectCoachConflicts(
  eventId: number,
  sb: SupabaseClient
): Promise<CoachConflictResult> {
  // 1. Query all coach_teams for this event, joining coaches and team_registrations
  const { data: assignments } = await sb
    .from('coach_teams')
    .select('coach_id, team_registration_id, coaches(name, email), team_registrations(team_name)')
    .eq('event_id', eventId)

  if (!assignments || assignments.length === 0) {
    return { conflicts: [], conflictingPairs: [], clean: true }
  }

  // 2. Group by coach_id — any coach with >1 team is a conflict
  const byCoach = new Map<
    number,
    { email: string; name: string; teams: { id: number; name: string }[] }
  >()
  for (const a of assignments) {
    const coachId = a.coach_id
    const existing = byCoach.get(coachId)
    const teamId = a.team_registration_id
    const teamName = (a.team_registrations as any)?.team_name ?? ''
    const coachEmail = (a.coaches as any)?.email ?? ''
    const coachName = (a.coaches as any)?.name ?? ''
    if (existing) {
      existing.teams.push({ id: teamId, name: teamName })
    } else {
      byCoach.set(coachId, {
        email: coachEmail,
        name: coachName,
        teams: [{ id: teamId, name: teamName }],
      })
    }
  }

  // 3. Build conflicts array and pairs
  const conflicts: CoachConflictEntry[] = []
  const conflictingPairs: [number, number][] = []

  for (const [coachId, data] of byCoach) {
    if (data.teams.length > 1) {
      conflicts.push({
        coach_id: coachId,
        coach_email: data.email,
        coach_name: data.name,
        team_ids: data.teams.map((t) => t.id),
        team_names: data.teams.map((t) => t.name),
      })
      // Generate all pairs from this coach's teams
      for (let i = 0; i < data.teams.length; i++) {
        for (let j = i + 1; j < data.teams.length; j++) {
          conflictingPairs.push([
            Math.min(data.teams[i].id, data.teams[j].id),
            Math.max(data.teams[i].id, data.teams[j].id),
          ])
        }
      }
    }
  }

  return { conflicts, conflictingPairs, clean: conflicts.length === 0 }
}

export async function getConflictingTeamPairs(
  eventId: number,
  sb: SupabaseClient
): Promise<Set<string>> {
  const result = await detectCoachConflicts(eventId, sb)
  const blocked = new Set<string>()
  for (const [a, b] of result.conflictingPairs) {
    blocked.add(`${a}-${b}`)
  }
  return blocked
}
