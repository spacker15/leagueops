import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { detectCoachConflicts, getConflictingTeamPairs } from '@/lib/engines/coach-conflicts'

describe('coach conflicts engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
  })

  it('Test 1: detectCoachConflicts returns clean result when no coaches share teams', async () => {
    // Coach 1 → team 10, Coach 2 → team 20 (distinct — no conflict)
    const assignments = [
      {
        coach_id: 1,
        team_registration_id: 10,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team A' },
      },
      {
        coach_id: 2,
        team_registration_id: 20,
        coaches: { name: 'Bob', email: 'bob@example.com' },
        team_registrations: { team_name: 'Team B' },
      },
    ]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: assignments, error: null })
    )

    const result = await detectCoachConflicts(1, mockSb)

    expect(result.conflicts).toHaveLength(0)
    expect(result.conflictingPairs).toHaveLength(0)
    expect(result.clean).toBe(true)
  })

  it('Test 2: detectCoachConflicts returns conflict when coach appears on 2+ teams', async () => {
    // Coach 1 on team 10 AND team 20 — conflict
    const assignments = [
      {
        coach_id: 1,
        team_registration_id: 10,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team A' },
      },
      {
        coach_id: 1,
        team_registration_id: 20,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team B' },
      },
    ]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: assignments, error: null })
    )

    const result = await detectCoachConflicts(1, mockSb)

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].coach_id).toBe(1)
    expect(result.conflicts[0].coach_email).toBe('alice@example.com')
    expect(result.conflicts[0].team_ids).toContain(10)
    expect(result.conflicts[0].team_ids).toContain(20)
    expect(result.clean).toBe(false)
  })

  it('Test 3: getConflictingTeamPairs returns Set with "minId-maxId" string keys', async () => {
    // Coach 1 on team 10 AND team 20 → pair should be "10-20"
    const assignments = [
      {
        coach_id: 1,
        team_registration_id: 10,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team A' },
      },
      {
        coach_id: 1,
        team_registration_id: 20,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team B' },
      },
    ]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: assignments, error: null })
    )

    const pairs = await getConflictingTeamPairs(1, mockSb)

    expect(pairs).toBeInstanceOf(Set)
    expect(pairs.has('10-20')).toBe(true)
    // Ensures min-max ordering (not 20-10)
    expect(pairs.has('20-10')).toBe(false)
  })

  it('Test 4: detectCoachConflicts handles empty coach_teams result gracefully', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: [], error: null })
    )

    const result = await detectCoachConflicts(1, mockSb)

    expect(result.conflicts).toHaveLength(0)
    expect(result.conflictingPairs).toHaveLength(0)
    expect(result.clean).toBe(true)
  })

  it('Test 5: Multiple coaches each on multiple teams returns all distinct conflicts', async () => {
    // Coach 1 on teams 10, 20, 30 → 3 pairs
    // Coach 2 on teams 40, 50 → 1 pair
    const assignments = [
      {
        coach_id: 1,
        team_registration_id: 10,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team A' },
      },
      {
        coach_id: 1,
        team_registration_id: 20,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team B' },
      },
      {
        coach_id: 1,
        team_registration_id: 30,
        coaches: { name: 'Alice', email: 'alice@example.com' },
        team_registrations: { team_name: 'Team C' },
      },
      {
        coach_id: 2,
        team_registration_id: 40,
        coaches: { name: 'Bob', email: 'bob@example.com' },
        team_registrations: { team_name: 'Team D' },
      },
      {
        coach_id: 2,
        team_registration_id: 50,
        coaches: { name: 'Bob', email: 'bob@example.com' },
        team_registrations: { team_name: 'Team E' },
      },
    ]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: assignments, error: null })
    )

    const result = await detectCoachConflicts(1, mockSb)

    // 2 coaches with conflicts
    expect(result.conflicts).toHaveLength(2)
    // Alice's conflict: 3 teams → 3 pairs (10-20, 10-30, 20-30)
    // Bob's conflict: 2 teams → 1 pair (40-50)
    expect(result.conflictingPairs).toHaveLength(4)

    const aliceConflict = result.conflicts.find((c) => c.coach_id === 1)
    const bobConflict = result.conflicts.find((c) => c.coach_id === 2)

    expect(aliceConflict).toBeDefined()
    expect(aliceConflict?.team_ids).toHaveLength(3)
    expect(bobConflict).toBeDefined()
    expect(bobConflict?.team_ids).toHaveLength(2)
    expect(result.clean).toBe(false)
  })
})
