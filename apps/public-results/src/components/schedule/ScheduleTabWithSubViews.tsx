'use client'
import Link from 'next/link'
import type { PublicGame, PublicTeam, PublicEventDate } from '@/lib/data'
import { ByTeamView } from './ByTeamView'
import { ByFieldView } from './ByFieldView'
import { ByTimeView } from './ByTimeView'
import { ByProgramView } from './ByProgramView'

interface Props {
  games: PublicGame[]
  teams: PublicTeam[]
  eventDates: PublicEventDate[]
  slug: string
  view: string
  activeDay: number
  teamId: number | null
  divFilter: string
}

const SUB_VIEWS = [
  { id: 'program', label: 'By Program' },
  { id: 'team', label: 'By Team' },
  { id: 'field', label: 'By Field' },
  { id: 'time', label: 'By Time' },
]

export function ScheduleTabWithSubViews({
  games,
  teams,
  eventDates,
  slug,
  view,
  activeDay,
  teamId,
  divFilter,
}: Props) {
  const activeView = SUB_VIEWS.some((v) => v.id === view) ? view : 'program'

  // Filter games by selected day
  const dayGames = games.filter((g) => g.event_date?.day_number === activeDay)
  // Filter by division
  const filtered = divFilter === 'ALL' ? dayGames : dayGames.filter((g) => g.division === divFilter)

  const sortedDates = [...eventDates].sort((a, b) => a.day_number - b.day_number)

  return (
    <div>
      {/* Sub-view toggle row */}
      <div className="flex items-center gap-1 mt-3 mb-4">
        {SUB_VIEWS.map((sv) => (
          <Link
            key={sv.id}
            href={`/e/${slug}?tab=schedule&view=${sv.id}&day=${activeDay}&div=${divFilter}`}
            className={`font-cond text-[10px] font-bold tracking-[.1em] uppercase rounded-md px-3 py-2 transition-colors ${
              activeView === sv.id ? 'bg-[#0B3D91] text-white' : 'text-[#5a6e9a] hover:text-white'
            }`}
          >
            {sv.label}
          </Link>
        ))}
      </div>

      {/* Day navigation row */}
      {sortedDates.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 no-scrollbar">
          {sortedDates.map((d) => {
            const label = d.label ?? `Day ${d.day_number}`
            return (
              <Link
                key={d.id}
                href={`/e/${slug}?tab=schedule&view=${activeView}&day=${d.day_number}&div=${divFilter}`}
                className={`font-cond text-[10px] font-bold tracking-[.1em] uppercase rounded-md px-3 py-2 transition-colors whitespace-nowrap ${
                  activeDay === d.day_number
                    ? 'bg-[#0B3D91] text-white'
                    : 'text-[#5a6e9a] hover:text-white'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}

      {/* Sub-view content */}
      {activeView === 'program' && (
        <ByProgramView
          games={filtered}
          teams={teams}
          slug={slug}
          activeDay={activeDay}
          divFilter={divFilter}
          teamId={teamId}
        />
      )}
      {activeView === 'team' && (
        <ByTeamView
          games={filtered}
          teams={teams}
          slug={slug}
          activeDay={activeDay}
          divFilter={divFilter}
          teamId={teamId}
        />
      )}
      {activeView === 'field' && <ByFieldView games={filtered} />}
      {activeView === 'time' && <ByTimeView games={filtered} />}
    </div>
  )
}
