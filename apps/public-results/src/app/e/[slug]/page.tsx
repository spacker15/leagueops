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
import { LiveScoresClient } from './LiveScoresClient'
import { EventTabContent } from './EventTabContent'
import { EventQRCode } from '@/components/EventQRCode'

export const revalidate = 30

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

      {/* Content wrapped in LiveScoresClient provider */}
      <LiveScoresClient initialGames={liveGames} eventId={event.id}>
        <EventTabContent
          activeTab={activeTab}
          divFilter={divFilter}
          games={games}
          teams={teams}
          eventDates={eventDates}
          slug={params.slug}
          scheduleView={scheduleView}
          activeDay={activeDay}
          teamId={teamId}
          viewStandings={viewStandings}
          bracket={bracket}
          finalGames={finalGames}
        />
      </LiveScoresClient>
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
