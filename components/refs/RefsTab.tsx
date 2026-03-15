'use client'

import { useApp } from '@/lib/store'
import { Avatar, Pill, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function RefsTab() {
  const { state, toggleRefCheckin, toggleVolCheckin } = useApp()

  async function handleRefToggle(id: number) {
    await toggleRefCheckin(id)
    const ref = state.referees.find(r => r.id === id)
    toast.success(`${ref?.name} ${ref?.checked_in ? 'checked out' : 'checked in'}`)
  }

  async function handleVolToggle(id: number) {
    await toggleVolCheckin(id)
    const vol = state.volunteers.find(v => v.id === id)
    toast.success(`${vol?.name} ${vol?.checked_in ? 'checked out' : 'checked in'}`)
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Referees */}
        <div>
          <SectionHeader>
            REFEREE ROSTER ({state.referees.filter(r => r.checked_in).length}/{state.referees.length} CHECKED IN)
          </SectionHeader>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {state.referees.map(ref => (
              <div
                key={ref.id}
                onClick={() => handleRefToggle(ref.id)}
                className={cn(
                  'flex gap-2 items-start p-2.5 rounded-md border cursor-pointer transition-all',
                  ref.checked_in
                    ? 'bg-green-900/10 border-green-800/50 hover:border-green-500/50'
                    : 'bg-surface-card border-border hover:border-blue-400'
                )}
              >
                <Avatar name={ref.name} variant="red" />
                <div className="min-w-0">
                  <div className="font-cond font-black text-[13px] truncate">{ref.name}</div>
                  <div className="font-cond text-[10px] text-muted tracking-wide">{ref.grade_level}</div>
                  <div className="mt-1">
                    {ref.checked_in
                      ? <Pill variant="green">CHECKED IN</Pill>
                      : <Pill variant="yellow">NOT IN</Pill>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volunteers */}
        <div>
          <SectionHeader>
            VOLUNTEER ROSTER ({state.volunteers.filter(v => v.checked_in).length}/{state.volunteers.length} CHECKED IN)
          </SectionHeader>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {state.volunteers.map(vol => (
              <div
                key={vol.id}
                onClick={() => handleVolToggle(vol.id)}
                className={cn(
                  'flex gap-2 items-start p-2.5 rounded-md border cursor-pointer transition-all',
                  vol.checked_in
                    ? 'bg-green-900/10 border-green-800/50 hover:border-green-500/50'
                    : 'bg-surface-card border-border hover:border-blue-400'
                )}
              >
                <Avatar name={vol.name} variant="blue" />
                <div className="min-w-0">
                  <div className="font-cond font-black text-[13px] truncate">{vol.name}</div>
                  <div className="font-cond text-[10px] text-muted tracking-wide">{vol.role}</div>
                  <div className="mt-1">
                    {vol.checked_in
                      ? <Pill variant="green">CHECKED IN</Pill>
                      : <Pill variant="yellow">NOT IN</Pill>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Assignments table */}
      <SectionHeader>GAME ASSIGNMENTS</SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-navy">
              {['GAME','FIELD','TIME','MATCHUP','DIVISION','STATUS'].map(h => (
                <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.games.sort((a,b) => a.scheduled_time.localeCompare(b.scheduled_time)).map(game => (
              <tr key={game.id} className="border-b border-border/40 hover:bg-white/5">
                <td className="font-mono text-muted text-[10px] px-3 py-2">#{game.id}</td>
                <td className="font-cond font-bold px-3 py-2">{game.field?.name ?? `F${game.field_id}`}</td>
                <td className="font-mono text-blue-300 text-[11px] px-3 py-2 whitespace-nowrap">{game.scheduled_time}</td>
                <td className="font-cond font-bold text-white px-3 py-2 whitespace-nowrap">
                  {game.home_team?.name ?? '?'} vs {game.away_team?.name ?? '?'}
                </td>
                <td className="px-3 py-2">
                  <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">{game.division}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'font-cond text-[10px] font-black tracking-wider px-2 py-0.5 rounded',
                    game.status === 'Live'    ? 'badge-live' :
                    game.status === 'Final'   ? 'badge-final' :
                    game.status === 'Delayed' ? 'badge-delayed' : 'badge-scheduled'
                  )}>{game.status.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
