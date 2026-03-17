'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { StatusBadge, Modal, Btn } from '@/components/ui'
import { cn, nextStatusLabel, nextGameStatus } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Game, GameStatus } from '@/types'

export function DashboardTab() {
  const { state, updateGameStatus, updateGameScore, addLog } = useApp()
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)

  function openGame(game: Game) {
    setSelectedGame(game)
    setHomeScore(game.home_score)
    setAwayScore(game.away_score)
  }

  async function handleStatusChange(game: Game, status: GameStatus) {
    await updateGameStatus(game.id, status)
    toast.success(`${game.field?.name} → ${status}`)
    setSelectedGame(prev => prev?.id === game.id ? { ...prev, status } : prev)
  }

  async function saveScore() {
    if (!selectedGame) return
    await updateGameScore(selectedGame.id, homeScore, awayScore)
    await addLog(`Score: ${selectedGame.home_team?.name} ${homeScore}–${awayScore} ${selectedGame.away_team?.name}`, 'info')
    toast.success('Score saved')
    setSelectedGame(null)
  }

  const fields = state.fields.slice(0, 12)
  const priority: GameStatus[] = ['Live','Starting','Halftime','Scheduled','Delayed','Final']

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-sm bg-red" />
        <span className="font-cond text-[13px] font-black tracking-[.15em] text-white uppercase">Field Command Board</span>
        <span className="font-cond text-[11px] text-muted ml-1">— {fields.length} fields · {state.games.filter(g => g.status === 'Live').length} live</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {fields.map(field => {
          const fieldGames = state.games.filter(g => g.field_id === field.id)
          let game: Game | undefined
          for (const p of priority) { game = fieldGames.find(g => g.status === p); if (game) break }
          if (!game) game = fieldGames[fieldGames.length - 1]
          return (
            <FieldCard key={field.id} field={field} game={game ?? null}
              onOpen={openGame}
              onCycleStatus={async g => { const n = nextGameStatus(g.status); if (n) await handleStatusChange(g, n) }}
            />
          )
        })}
      </div>

      <Modal open={!!selectedGame} onClose={() => setSelectedGame(null)}
        title={selectedGame ? `GAME #${selectedGame.id}` : ''}
        footer={<><Btn variant="ghost" size="sm" onClick={() => setSelectedGame(null)}>CLOSE</Btn><Btn size="sm" onClick={saveScore}>SAVE</Btn></>}>
        {selectedGame && (
          <GameDetail game={selectedGame} homeScore={homeScore} awayScore={awayScore}
            onHomeScore={setHomeScore} onAwayScore={setAwayScore}
            onStatus={s => handleStatusChange(selectedGame, s)} />
        )}
      </Modal>
    </div>
  )
}

// ── Field Card — scoreboard style ─────────────────────────────
function FieldCard({ field, game, onOpen, onCycleStatus }: {
  field: { id: number; name: string }
  game: Game | null
  onOpen: (g: Game) => void
  onCycleStatus: (g: Game) => void
}) {
  const isLive     = game?.status === 'Live'
  const isHalftime = game?.status === 'Halftime'
  const isDelayed  = game?.status === 'Delayed'
  const hasScore   = game && ['Live','Halftime','Final'].includes(game.status)

  const borderColor = isLive     ? '#22c55e'
    : isHalftime ? '#facc15'
    : isDelayed  ? '#f87171'
    : game?.status === 'Starting' ? '#fb923c'
    : '#1a2d50'

  const glowStyle = isLive ? { boxShadow: '0 0 0 1px #22c55e20, 0 4px 20px #22c55e18' } : {}

  return (
    <div className="rounded-xl overflow-hidden cursor-pointer transition-all hover:translate-y-[-1px]"
      style={{ background: '#081428', border: `1px solid ${borderColor}`, ...glowStyle }}
      onClick={() => game && onOpen(game)}>

      {/* Field header */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ background: '#0a1a3a', borderBottom: `1px solid ${borderColor}30` }}>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 rounded-full bg-green-500/25 live-dot scale-150" />
              <div className="w-2 h-2 rounded-full bg-green-500 relative z-10" />
            </div>
          )}
          <span className="font-cond text-[14px] font-black tracking-[.08em] text-white">{field.name.toUpperCase()}</span>
        </div>
        {game ? <StatusBadge status={game.status} /> : (
          <span className="font-cond text-[9px] font-black tracking-[.15em]" style={{ color: '#1e2d40' }}>OPEN</span>
        )}
      </div>

      {!game ? (
        <div className="px-3 py-4 font-cond text-[11px] font-black tracking-[.1em]" style={{ color: '#1e2d40' }}>
          NO GAMES SCHEDULED
        </div>
      ) : (
        <div className="p-3">
          {/* Scoreboard row */}
          <div className="flex items-center mb-2.5">
            <div className="flex-1 min-w-0">
              <div className="font-cond text-[15px] font-black text-white truncate leading-tight">{game.home_team?.name ?? '?'}</div>
              <div className="font-cond text-[9px] tracking-[.1em]" style={{ color: '#5a6e9a' }}>HOME</div>
            </div>

            {hasScore ? (
              <div className="flex items-center gap-1 px-3">
                <span className="font-mono text-[26px] font-black text-white tabular-nums leading-none">{game.home_score}</span>
                <span className="font-cond text-[14px] font-black" style={{ color: '#1a2d50' }}>–</span>
                <span className="font-mono text-[26px] font-black text-white tabular-nums leading-none">{game.away_score}</span>
              </div>
            ) : (
              <div className="px-4">
                <span className="font-cond text-[11px] font-black" style={{ color: '#2a3d60' }}>VS</span>
              </div>
            )}

            <div className="flex-1 min-w-0 text-right">
              <div className="font-cond text-[15px] font-black text-white truncate leading-tight">{game.away_team?.name ?? '?'}</div>
              <div className="font-cond text-[9px] tracking-[.1em] text-right" style={{ color: '#5a6e9a' }}>AWAY</div>
            </div>
          </div>

          {/* Info row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold" style={{ color: '#5a6e9a' }}>{game.scheduled_time}</span>
              <span className="font-cond text-[10px] font-bold" style={{ color: '#3a4d70' }}>·</span>
              <span className="font-cond text-[10px] font-bold tracking-wide" style={{ color: '#3a4d70' }}>{game.division}</span>
            </div>
            {game.status !== 'Final' && (
              <button
                className="font-cond text-[10px] font-black tracking-[.08em] px-2.5 py-1 rounded transition-colors"
                style={{ background: '#0d1f3a', border: '1px solid #1a3060', color: '#60a5fa' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0B3D91'; (e.currentTarget as HTMLElement).style.color = 'white' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0d1f3a'; (e.currentTarget as HTMLElement).style.color = '#60a5fa' }}
                onClick={e => { e.stopPropagation(); onCycleStatus(game) }}>
                {nextStatusLabel(game.status)} →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Game detail modal ─────────────────────────────────────────
function GameDetail({ game, homeScore, awayScore, onHomeScore, onAwayScore, onStatus }: {
  game: Game; homeScore: number; awayScore: number
  onHomeScore: (v: number) => void; onAwayScore: (v: number) => void
  onStatus: (s: GameStatus) => void
}) {
  const statuses: GameStatus[] = ['Scheduled','Starting','Live','Halftime','Final','Delayed']
  return (
    <div>
      {/* Big matchup */}
      <div className="rounded-xl p-5 mb-5 text-center" style={{ background: '#040e20', border: '1px solid #1a2d50' }}>
        <div className="font-cond text-[11px] font-black tracking-[.15em] mb-3" style={{ color: '#3a4d70' }}>
          {game.field?.name?.toUpperCase()} · {game.scheduled_time} · {game.division}
        </div>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center flex-1">
            <div className="font-cond text-[20px] font-black text-white leading-tight">{game.home_team?.name}</div>
            <div className="font-cond text-[9px] tracking-[.15em]" style={{ color: '#3a4d70' }}>HOME</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onHomeScore(Math.max(0, homeScore - 1))} className="w-7 h-7 rounded font-cond font-black text-lg text-white transition-colors" style={{ background: '#1a2d50' }}
              onMouseEnter={e => (e.currentTarget.style.background='#0B3D91')} onMouseLeave={e => (e.currentTarget.style.background='#1a2d50')}>−</button>
            <span className="font-mono text-[42px] font-black text-white tabular-nums leading-none w-10 text-center">{homeScore}</span>
            <button onClick={() => onHomeScore(homeScore + 1)} className="w-7 h-7 rounded font-cond font-black text-lg text-white transition-colors" style={{ background: '#1a2d50' }}
              onMouseEnter={e => (e.currentTarget.style.background='#0B3D91')} onMouseLeave={e => (e.currentTarget.style.background='#1a2d50')}>+</button>
            <span className="font-cond text-[28px] font-black mx-2" style={{ color: '#1a2d50' }}>–</span>
            <button onClick={() => onAwayScore(Math.max(0, awayScore - 1))} className="w-7 h-7 rounded font-cond font-black text-lg text-white transition-colors" style={{ background: '#1a2d50' }}
              onMouseEnter={e => (e.currentTarget.style.background='#0B3D91')} onMouseLeave={e => (e.currentTarget.style.background='#1a2d50')}>−</button>
            <span className="font-mono text-[42px] font-black text-white tabular-nums leading-none w-10 text-center">{awayScore}</span>
            <button onClick={() => onAwayScore(awayScore + 1)} className="w-7 h-7 rounded font-cond font-black text-lg text-white transition-colors" style={{ background: '#1a2d50' }}
              onMouseEnter={e => (e.currentTarget.style.background='#0B3D91')} onMouseLeave={e => (e.currentTarget.style.background='#1a2d50')}>+</button>
          </div>
          <div className="text-center flex-1">
            <div className="font-cond text-[20px] font-black text-white leading-tight">{game.away_team?.name}</div>
            <div className="font-cond text-[9px] tracking-[.15em]" style={{ color: '#3a4d70' }}>AWAY</div>
          </div>
        </div>
      </div>

      {/* Status buttons */}
      <div className="font-cond text-[9px] font-black tracking-[.15em] mb-2" style={{ color: '#3a4d70' }}>GAME STATUS</div>
      <div className="flex flex-wrap gap-2">
        {statuses.map(s => (
          <button key={s} onClick={() => onStatus(s)}
            className="font-cond text-[11px] font-black tracking-[.1em] px-3 py-1.5 rounded transition-all"
            style={{
              background: game.status === s ? '#0B3D91' : '#0a1428',
              border: `1px solid ${game.status === s ? '#1a52b8' : '#1a2d50'}`,
              color: game.status === s ? 'white' : '#5a6e9a',
            }}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
