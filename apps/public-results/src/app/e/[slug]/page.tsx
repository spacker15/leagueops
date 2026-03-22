import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublicEventBySlug, getPublicGames, getPublicTeams, computeStandings } from '@/lib/data'
import type { PublicGame, Standing } from '@/lib/data'

export const revalidate = 30 // revalidate every 30 seconds

interface Props {
  params: { slug: string }
  searchParams: { tab?: string; div?: string }
}

export default async function EventPage({ params, searchParams }: Props) {
  const event = await getPublicEventBySlug(params.slug)
  if (!event) notFound()

  const [games, teams] = await Promise.all([getPublicGames(event.id), getPublicTeams(event.id)])

  const activeTab = searchParams.tab ?? 'standings'
  const divFilter = searchParams.div ?? 'ALL'

  const divisions = ['ALL', ...Array.from(new Set(teams.map((t) => t.division))).sort()]

  const finalGames = games.filter((g) => g.status === 'Final')
  const liveGames = games.filter((g) => g.status === 'Live' || g.status === 'Halftime')

  const allStandings = computeStandings(teams, games)
  const byDivision = groupBy(allStandings, (s) => s.division)

  const tabs = [
    { id: 'standings', label: 'Standings' },
    { id: 'results', label: `Results (${finalGames.length})` },
    { id: 'live', label: `Live (${liveGames.length})`, highlight: liveGames.length > 0 },
  ]

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[#5a6e9a] font-cond text-[11px] font-bold tracking-[.1em] uppercase">
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
          <div>
            <h1 className="font-cond text-[20px] font-black text-white">{event.name}</h1>
            <div className="font-cond text-[13px] text-[#5a6e9a] mt-0.5">{event.location}</div>
          </div>
          <div className="ml-auto flex gap-3">
            <StatPill label="Teams" value={teams.length} />
            <StatPill label="Games" value={games.length} />
            <StatPill label="Final" value={finalGames.length} />
            {liveGames.length > 0 && <StatPill label="Live" value={liveGames.length} highlight />}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#1a2d50] pb-0">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/e/${params.slug}?tab=${tab.id}`}
            className={`relative px-4 py-2 font-cond text-[11px] font-black tracking-[.1em] uppercase transition-colors ${
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
        {activeTab === 'standings' && divisions.length > 2 && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            {divisions.map((d) => (
              <Link
                key={d}
                href={`/e/${params.slug}?tab=standings&div=${d}`}
                className={`px-2.5 py-1 rounded font-cond text-[10px] font-black tracking-[.1em] uppercase transition-colors ${
                  divFilter === d ? 'bg-[#0B3D91] text-white' : 'text-[#5a6e9a] hover:text-white'
                }`}
              >
                {d}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'standings' && (
        <StandingsSection byDivision={byDivision} divFilter={divFilter} />
      )}
      {activeTab === 'results' && <ResultsSection games={finalGames} />}
      {activeTab === 'live' && <LiveSection games={liveGames} />}
    </div>
  )
}

// ─── Sections ────────────────────────────────────────────────────────────────

function StandingsSection({
  byDivision,
  divFilter,
}: {
  byDivision: Record<string, Standing[]>
  divFilter: string
}) {
  const entries = Object.entries(byDivision)
    .filter(([div]) => divFilter === 'ALL' || div === divFilter)
    .sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) {
    return <Empty message="No standings data yet." />
  }

  return (
    <div className="space-y-6">
      {entries.map(([division, rows]) => {
        const sorted = [...rows].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        return (
          <div key={division}>
            <div className="font-cond text-[10px] font-black tracking-[.15em] text-[#5a6e9a] uppercase mb-2">
              {division}
            </div>
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#1a2d50]">
                    {['#', 'Team', 'GP', 'W', 'L', 'T', 'GF', 'GA', 'GD', 'PTS'].map((h) => (
                      <th
                        key={h}
                        className={`font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase py-2.5 ${
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
                    <tr key={s.teamId} className="border-b border-[#1a2d50]/50 last:border-0">
                      <td className="text-center px-2 py-2.5 font-mono text-[#5a6e9a] text-[11px]">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-cond font-bold text-white">{s.name}</span>
                        {s.association && (
                          <span className="ml-1.5 text-[#5a6e9a] text-[11px]">{s.association}</span>
                        )}
                      </td>
                      <td className="text-center px-2 py-2.5 font-mono text-white">{s.gp}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-green-400 font-bold">
                        {s.w}
                      </td>
                      <td className="text-center px-2 py-2.5 font-mono text-red-400">{s.l}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-yellow-400">{s.t}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-white">{s.gf}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-white">{s.ga}</td>
                      <td
                        className={`text-center px-2 py-2.5 font-mono ${
                          s.gd > 0 ? 'text-green-400' : s.gd < 0 ? 'text-red-400' : 'text-[#5a6e9a]'
                        }`}
                      >
                        {s.gd > 0 ? `+${s.gd}` : s.gd}
                      </td>
                      <td className="text-center px-2 py-2.5 font-mono font-bold text-white">
                        {s.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="font-cond text-[9px] text-[#5a6e9a] mt-1 tracking-wide">
              W = 3 pts · T = 1 pt · Tiebreakers: GD → GF
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
            <div className="font-cond text-[10px] font-black tracking-[.15em] text-[#5a6e9a] uppercase mb-2">
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

function LiveSection({ games }: { games: PublicGame[] }) {
  if (games.length === 0) {
    return <Empty message="No games in progress right now." />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-cond text-[11px] font-black tracking-[.12em] text-green-400 uppercase">
          {games.length} Game{games.length > 1 ? 's' : ''} In Progress
        </span>
      </div>
      {games.map((game) => (
        <GameResultCard key={game.id} game={game} live />
      ))}
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function GameResultCard({ game, live = false }: { game: PublicGame; live?: boolean }) {
  const homeWon = game.status === 'Final' && game.home_score > game.away_score
  const awayWon = game.status === 'Final' && game.away_score > game.home_score

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
            className={`font-mono font-bold text-[18px] tabular-nums ${homeWon ? 'text-white' : live ? 'text-green-400' : 'text-[#5a6e9a]'}`}
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
            className={`font-mono font-bold text-[18px] tabular-nums ${awayWon ? 'text-white' : live ? 'text-green-400' : 'text-[#5a6e9a]'}`}
          >
            {game.away_score}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div className="font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase">
          {game.division}
        </div>
        <div className="font-cond text-[11px] text-[#5a6e9a]">{game.field?.name ?? '—'}</div>
        {live ? (
          <div className="font-cond text-[10px] font-black tracking-[.1em] text-green-400 uppercase">
            {game.status}
          </div>
        ) : (
          <div className="font-cond text-[10px] font-black tracking-[.1em] text-[#5a6e9a] uppercase">
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
      <div className="font-cond text-[9px] font-black tracking-[.12em] text-[#5a6e9a] uppercase">
        {label}
      </div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
      <div className="font-cond text-[11px] font-black tracking-[.18em] text-[#5a6e9a] uppercase">
        {message}
      </div>
    </div>
  )
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    },
    {} as Record<string, T[]>
  )
}
