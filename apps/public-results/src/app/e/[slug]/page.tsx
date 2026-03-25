import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getPublicEventBySlug,
  getPublicGames,
  getPublicTeams,
  getPublicEventDates,
  getPublicBracket,
  getPublicStandings,
} from '@/lib/data'
import type { PublicGame, ViewStanding } from '@/lib/data'
import { groupBy } from '@/lib/utils'
import { LiveScoresClient } from './LiveScoresClient'
import { ScheduleTabWithSubViews } from '@/components/schedule/ScheduleTabWithSubViews'
import { BracketTab } from '@/components/bracket/BracketTab'
import { EventQRCode } from '@/components/EventQRCode'

export const revalidate = 30 // ISR: revalidate every 30 seconds (per D-16)

interface Props {
  params: { slug: string }
  searchParams: { tab?: string; div?: string; view?: string; day?: string; team?: string }
}

export default async function EventPage({ params, searchParams }: Props) {
  const event = await getPublicEventBySlug(params.slug)
  if (!event) notFound()

  const [games, teams, eventDates, bracket, viewStandings] = await Promise.all([
    getPublicGames(event.id),
    getPublicTeams(event.id),
    getPublicEventDates(event.id),
    getPublicBracket(event.id),
    getPublicStandings(event.id),
  ])

  const activeTab = searchParams.tab ?? 'standings'
  const divFilter = searchParams.div ?? 'ALL'
  const scheduleView = (searchParams.view ?? 'team') as string
  const activeDay = searchParams.day ? Number(searchParams.day) : 1
  const teamId = searchParams.team ? Number(searchParams.team) : null

  const divisions = ['ALL', ...Array.from(new Set(teams.map((t) => t.division))).sort()]

  const finalGames = games.filter((g) => g.status === 'Final')
  const liveGames = games.filter((g) => g.status === 'Live' || g.status === 'Halftime')

  // Group standings by division from PostgreSQL view
  const standingsByDivision = groupBy(viewStandings, (s) => s.division)

  const tabs = [
    { id: 'standings', label: 'Standings' },
    ...(event.public_schedule ? [{ id: 'schedule', label: `Schedule (${games.length})` }] : []),
    { id: 'results', label: `Results (${finalGames.length})` },
    { id: 'live', label: `Live (${liveGames.length})`, highlight: liveGames.length > 0 },
    ...(event.has_bracket && bracket.format ? [{ id: 'bracket', label: 'Bracket' }] : []),
  ]

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[#5a6e9a] font-cond text-[10px] font-bold tracking-[.1em] uppercase">
        <Link href="/" className="hover:text-white transition-colors">
          All Events
        </Link>
        <span>/</span>
        <span className="text-white">{event.name}</span>
      </div>

      {/* Event header */}
      <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-5">
        <div className="flex items-start gap-4">
          {event.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.logo_url}
              alt={event.name}
              className="w-14 h-14 object-contain rounded"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-cond text-[20px] font-bold text-white">{event.name}</h1>
            <div className="font-cond text-[12px] text-[#5a6e9a] mt-0.5">{event.location}</div>
          </div>
          <div className="ml-auto flex gap-3 shrink-0">
            <StatPill label="Teams" value={teams.length} />
            <StatPill label="Games" value={games.length} />
            <StatPill label="Final" value={finalGames.length} />
            {liveGames.length > 0 && <StatPill label="Live" value={liveGames.length} highlight />}
          </div>
          {/* QR code: visible on desktop, collapsed on mobile */}
          <div className="hidden lg:block shrink-0">
            <EventQRCode slug={params.slug} size={80} />
          </div>
        </div>
        <details className="lg:hidden mt-3">
          <summary className="font-cond text-[10px] font-bold text-[#5a6e9a] uppercase tracking-[.1em] cursor-pointer">
            Show QR Code
          </summary>
          <div className="mt-2">
            <EventQRCode slug={params.slug} />
          </div>
        </details>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 flex-wrap border-b border-[#1a2d50] pb-0">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/e/${params.slug}?tab=${tab.id}`}
            className={`relative px-4 py-3 font-cond text-[10px] font-bold tracking-[.1em] uppercase transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-[#5a6e9a] hover:text-white'
            } ${tab.highlight ? 'text-green-400' : ''}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0B3D91]" />
            )}
          </Link>
        ))}

        {/* Division filter */}
        {(activeTab === 'standings' || activeTab === 'schedule') && divisions.length > 2 && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            {divisions.map((d) => (
              <Link
                key={d}
                href={`/e/${params.slug}?tab=${activeTab}&div=${d}`}
                className={`px-2.5 py-1 rounded font-cond text-[10px] font-bold tracking-[.1em] uppercase transition-colors ${
                  divFilter === d ? 'bg-[#0B3D91] text-white' : 'text-[#5a6e9a] hover:text-white'
                }`}
              >
                {d}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Content wrapped in LiveScoresClient for real-time updates */}
      <LiveScoresClient initialGames={liveGames} eventId={event.id}>
        {(currentLiveGames, flashingIds) => {
          const liveGameIds = new Set(currentLiveGames.map((g) => g.id))
          const liveScores = new Map(
            currentLiveGames.map((g) => [
              g.id,
              { home_score: g.home_score, away_score: g.away_score },
            ])
          )

          return (
            <>
              {activeTab === 'standings' && (
                <StandingsSection
                  standingsByDivision={standingsByDivision}
                  divFilter={divFilter}
                />
              )}
              {activeTab === 'schedule' && (
                <ScheduleTabWithSubViews
                  games={games}
                  teams={teams}
                  eventDates={eventDates}
                  slug={params.slug}
                  view={scheduleView}
                  activeDay={activeDay}
                  teamId={teamId}
                  divFilter={divFilter}
                />
              )}
              {activeTab === 'results' && <ResultsSection games={finalGames} />}
              {activeTab === 'live' && (
                <LiveSectionEnhanced
                  games={currentLiveGames}
                  allGames={games}
                  flashingIds={flashingIds}
                />
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
        }}
      </LiveScoresClient>
    </div>
  )
}

// ─── Sections ────────────────────────────────────────────────────────────────

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
        // Already sorted by Supabase query, but sort locally too for safety
        const sorted = [...rows].sort(
          (a, b) =>
            b.wins - a.wins ||
            b.goal_diff - a.goal_diff ||
            b.points_for - a.points_for
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
                          <span className="ml-1.5 text-[#5a6e9a] text-[10px]">
                            {s.association}
                          </span>
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
                <GameResultCard key={game.id} game={game} />
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
      .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
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
        <GameResultCard key={game.id} game={game} live flashingIds={flashingIds} />
      ))}
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function GameResultCard({
  game,
  live = false,
  flashingIds,
}: {
  game: PublicGame
  live?: boolean
  flashingIds?: Set<number>
}) {
  const homeWon = game.status === 'Final' && game.home_score > game.away_score
  const awayWon = game.status === 'Final' && game.away_score > game.home_score
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
          <span
            className={`font-mono font-bold text-[18px] tabular-nums ${isFlashing ? 'score-flash' : ''} ${homeWon ? 'text-white' : live ? 'text-green-400' : 'text-[#5a6e9a]'}`}
          >
            {game.home_score}
          </span>
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
          <span
            className={`font-mono font-bold text-[18px] tabular-nums ${isFlashing ? 'score-flash' : ''} ${awayWon ? 'text-white' : live ? 'text-green-400' : 'text-[#5a6e9a]'}`}
          >
            {game.away_score}
          </span>
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

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="text-center">
      <div
        className={`font-mono font-bold text-[18px] ${highlight ? 'text-green-400' : 'text-white'}`}
      >
        {value}
      </div>
      <div className="font-cond text-[10px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase">
        {label}
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
