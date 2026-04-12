'use client'

import { useLiveScores } from './LiveScoresClient'
import { ScheduleTabWithSubViews } from '@/components/schedule/ScheduleTabWithSubViews'
import { BracketTab } from '@/components/bracket/BracketTab'
import type {
  PublicGame,
  PublicTeam,
  PublicEventDate,
  ViewStanding,
  BracketRound,
} from '@/lib/data'
import { groupBy } from '@/lib/utils'
import Link from 'next/link'

function timeToMin(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + min
}

interface Props {
  activeTab: string
  divFilter: string
  games: PublicGame[]
  teams: PublicTeam[]
  eventDates: PublicEventDate[]
  slug: string
  scheduleView: string
  activeDay: number
  teamId: number | null
  viewStandings: ViewStanding[]
  bracket: { format: 'single' | 'double' | null; rounds: BracketRound[] }
  finalGames: PublicGame[]
  hideScores: boolean
}

export function EventTabContent({
  activeTab,
  divFilter,
  games,
  teams,
  eventDates,
  slug,
  scheduleView,
  activeDay,
  teamId,
  viewStandings,
  bracket,
  finalGames,
  hideScores,
}: Props) {
  const { liveGames, flashingIds, liveGameIds, liveScores } = useLiveScores()
  const standingsByDivision = groupBy(viewStandings, (s) => s.division)

  return (
    <>
      {activeTab === 'standings' && (
        <StandingsSection standingsByDivision={standingsByDivision} divFilter={divFilter} />
      )}
      {activeTab === 'schedule' && (
        <ScheduleTabWithSubViews
          games={games}
          teams={teams}
          eventDates={eventDates}
          slug={slug}
          view={scheduleView}
          activeDay={activeDay}
          teamId={teamId}
          divFilter={divFilter}
          hideScores={hideScores}
        />
      )}
      {activeTab === 'results' && <ResultsSection games={finalGames} />}
      {activeTab === 'live' && (
        <LiveSectionEnhanced games={liveGames} allGames={games} flashingIds={flashingIds} />
      )}
      {activeTab === 'bracket' && bracket.format && (
        <BracketTab
          bracket={bracket}
          liveGameIds={liveGameIds}
          liveScores={liveScores}
          flashingIds={flashingIds}
        />
      )}
    </>
  )
}

// ─── Sections (moved here as client components) ───────────────────────────────

function StandingsSection({
  standingsByDivision,
  divFilter,
}: {
  standingsByDivision: Record<string, ViewStanding[]>
  divFilter: string
}) {
  const entries = Object.entries(standingsByDivision)
    .filter(([div]) => divFilter === 'ALL' || div === divFilter)
    .sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) {
    return <Empty message="No standings data yet." />
  }

  return (
    <div className="space-y-6">
      {entries.map(([division, rows]) => {
        const sorted = [...rows].sort(
          (a, b) => b.wins - a.wins || b.goal_diff - a.goal_diff || b.points_for - a.points_for
        )
        return (
          <div key={division}>
            <div className="font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase mb-2">
              {division}
            </div>
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#1a2d50]">
                    {['#', 'Team', 'W', 'L', 'T', 'GF', 'GA', 'GD'].map((h) => (
                      <th
                        key={h}
                        className={`font-cond text-[10px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase py-2 ${
                          h === 'Team' ? 'text-left px-4' : 'text-center px-2'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => (
                    <tr key={s.team_id} className="border-b border-[#1a2d50]/50 last:border-0">
                      <td className="text-center px-2 py-2 font-mono text-[#5a6e9a] text-[10px]">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-cond font-bold text-white">{s.team_name}</span>
                        {s.association && (
                          <span className="ml-1.5 text-[#5a6e9a] text-[10px]">{s.association}</span>
                        )}
                      </td>
                      <td className="text-center px-2 py-2 font-mono text-green-400 font-bold">
                        {s.wins}
                      </td>
                      <td className="text-center px-2 py-2 font-mono text-red-400">{s.losses}</td>
                      <td className="text-center px-2 py-2 font-mono text-yellow-400">{s.ties}</td>
                      <td className="text-center px-2 py-2 font-mono text-white">{s.points_for}</td>
                      <td className="text-center px-2 py-2 font-mono text-white">
                        {s.points_against}
                      </td>
                      <td
                        className={`text-center px-2 py-2 font-mono ${
                          s.goal_diff > 0
                            ? 'text-green-400'
                            : s.goal_diff < 0
                              ? 'text-red-400'
                              : 'text-[#5a6e9a]'
                        }`}
                      >
                        {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResultsSection({ games }: { games: PublicGame[] }) {
  if (games.length === 0) return <Empty message="No completed games yet." />

  const sorted = [...games].sort((a, b) => {
    const ta = a.scheduled_time ?? ''
    const tb = b.scheduled_time ?? ''
    return ta < tb ? 1 : -1
  })

  const byDiv = groupBy(sorted, (g) => g.division)

  return (
    <div className="space-y-5">
      {Object.entries(byDiv)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([division, divGames]) => (
          <div key={division}>
            <div className="font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase mb-2">
              {division}
            </div>
            <div className="space-y-2">
              {divGames.map((game) => (
                <GameResultCard key={game.id} game={game} hideScores={hideScores} />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

function LiveSectionEnhanced({
  games,
  allGames,
  flashingIds,
}: {
  games: PublicGame[]
  allGames: PublicGame[]
  flashingIds: Set<number>
}) {
  if (games.length === 0) {
    const nextGame = allGames
      .filter((g) => g.status === 'Scheduled')
      .sort((a, b) => timeToMin(a.scheduled_time ?? '') - timeToMin(b.scheduled_time ?? ''))
      .at(0)

    return (
      <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
        <div className="font-cond text-[12px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
          No games in progress right now.
        </div>
        {nextGame && (
          <div className="font-cond text-[12px] text-[#5a6e9a] mt-2">
            Next game: {nextGame.scheduled_time ?? '—'} on {nextGame.field?.name ?? '—'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-cond text-[10px] font-bold tracking-[.12em] text-green-400 uppercase">
          {games.length} Game{games.length > 1 ? 's' : ''} In Progress
        </span>
      </div>
      {games.map((game) => (
        <GameResultCard
          key={game.id}
          game={game}
          live
          flashingIds={flashingIds}
          hideScores={hideScores}
        />
      ))}
    </div>
  )
}

function GameResultCard({
  game,
  live = false,
  flashingIds,
  hideScores = false,
}: {
  game: PublicGame
  live?: boolean
  flashingIds?: Set<number>
  hideScores?: boolean
}) {
  const homeWon = !hideScores && game.status === 'Final' && game.home_score > game.away_score
  const awayWon = !hideScores && game.status === 'Final' && game.away_score > game.home_score
  const isFlashing = flashingIds?.has(game.id) ?? false

  return (
    <div
      className={`bg-[#081428] border rounded-xl px-4 py-3 flex items-center gap-4 ${
        live ? 'border-green-400/30' : 'border-[#1a2d50]'
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`font-cond font-bold text-[14px] truncate ${homeWon ? 'text-white' : 'text-[#5a6e9a]'}`}
          >
            {homeWon && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 mb-0.5" />
            )}
            {game.home_team?.name ?? 'Home'}
          </span>
          {!hideScores && (
            <span
              className={`font-mono font-bold text-[18px] tabular-nums ${isFlashing ? 'score-flash' : ''} ${homeWon ? 'text-white' : live ? 'text-green-400' : 'text-[#5a6e9a]'}`}
            >
              {game.home_score}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span
            className={`font-cond font-bold text-[14px] truncate ${awayWon ? 'text-white' : 'text-[#5a6e9a]'}`}
          >
            {awayWon && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 mb-0.5" />
            )}
            {game.away_team?.name ?? 'Away'}
          </span>
          {!hideScores && (
            <span
              className={`font-mono font-bold text-[18px] tabular-nums ${isFlashing ? 'score-flash' : ''} ${awayWon ? 'text-white' : live ? 'text-green-400' : 'text-[#5a6e9a]'}`}
            >
              {game.away_score}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div className="font-cond text-[10px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase">
          {game.division}
        </div>
        <div className="font-cond text-[10px] text-[#5a6e9a]">{game.field?.name ?? '—'}</div>
        {live ? (
          <div className="font-cond text-[10px] font-bold tracking-[.1em] text-green-400 uppercase">
            {game.status}
          </div>
        ) : (
          <div className="font-cond text-[10px] font-bold tracking-[.1em] text-[#5a6e9a] uppercase">
            Final
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
      <div className="font-cond text-[12px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
        {message}
      </div>
    </div>
  )
}
