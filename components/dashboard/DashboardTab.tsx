'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { StatusBadge, Modal, Btn, FormField, Input, Select } from '@/components/ui'
import { cn, nextStatusLabel, nextGameStatus } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Game, GameStatus } from '@/types'
import * as db from '@/lib/db'

export function DashboardTab() {
  const { state, updateGameStatus, updateGameScore, addLog } = useApp()
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)

  const fields = state.fields.slice(0, 8)

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
    await addLog(
      `Score updated: ${selectedGame.home_team?.name} ${homeScore}–${awayScore} ${selectedGame.away_team?.name}`,
      'info'
    )
    toast.success('Score updated')
    setSelectedGame(null)
  }

  return (
    <div>
      <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase border-b border-border pb-1 mb-3">
        FIELD COMMAND BOARD
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-2">
        {fields.map(field => {
          const fieldGames = state.games.filter(g => g.field_id === field.id)
          // Priority: Live > Starting > Halftime > Scheduled > Final
          const priority: GameStatus[] = ['Live','Starting','Halftime','Scheduled','Final']
          let game: Game | undefined
          for (const p of priority) {
            game = fieldGames.find(g => g.status === p)
            if (game) break
          }
          if (!game) game = fieldGames[fieldGames.length - 1]

          return (
            <FieldCard
              key={field.id}
              field={field}
              game={game ?? null}
              onOpen={openGame}
              onCycleStatus={async (g) => {
                const next = nextGameStatus(g.status)
                if (next) await handleStatusChange(g, next)
              }}
            />
          )
        })}
      </div>

      {/* Game Detail Modal */}
      <Modal
        open={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        title={selectedGame ? `GAME #${selectedGame.id}: ${selectedGame.home_team?.name ?? ''} vs ${selectedGame.away_team?.name ?? ''}` : ''}
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setSelectedGame(null)}>CLOSE</Btn>
            <Btn variant="primary" size="sm" onClick={saveScore}>SAVE SCORE</Btn>
          </>
        }
      >
        {selectedGame && (
          <GameDetailBody
            game={selectedGame}
            homeScore={homeScore}
            awayScore={awayScore}
            onHomeScore={setHomeScore}
            onAwayScore={setAwayScore}
            onStatus={(s) => handleStatusChange(selectedGame, s)}
          />
        )}
      </Modal>
    </div>
  )
}

// ---- Field Card ----
function FieldCard({
  field, game, onOpen, onCycleStatus
}: {
  field: { id: number; name: string }
  game: Game | null
  onOpen: (g: Game) => void
  onCycleStatus: (g: Game) => void
}) {
  const statusBorder: Partial<Record<GameStatus, string>> = {
    Live:     'border-green-500/60',
    Delayed:  'border-red-500/60',
    Halftime: 'border-yellow-500/60',
    Starting: 'border-orange-500/60',
  }

  const borderCls = game ? (statusBorder[game.status] ?? 'border-border') : 'border-border'

  return (
    <div
      className={cn(
        'field-card bg-surface-card border rounded-md overflow-hidden cursor-pointer',
        borderCls
      )}
      onClick={() => game && onOpen(game)}
    >
      {/* Header */}
      <div className="bg-navy px-3 py-1.5 flex justify-between items-center">
        <span className="font-cond text-[13px] font-black tracking-wide">{field.name}</span>
        {game ? <StatusBadge status={game.status} /> : (
          <span className="font-cond text-[10px] font-bold text-muted tracking-widest">OPEN</span>
        )}
      </div>

      {/* Body */}
      {!game ? (
        <div className="p-3 text-[11px] text-muted font-cond font-bold tracking-wide">NO GAMES SCHEDULED</div>
      ) : (
        <div className="p-3">
          {/* Matchup */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-cond text-[14px] font-black flex-1 truncate">{game.home_team?.name ?? '?'}</span>
            {['Live','Halftime','Final'].includes(game.status) ? (
              <span className="font-mono text-lg text-green-400 px-2">
                {game.home_score}–{game.away_score}
              </span>
            ) : (
              <span className="font-cond text-[11px] text-muted px-2">vs</span>
            )}
            <span className="font-cond text-[14px] font-black flex-1 text-right truncate">{game.away_team?.name ?? '?'}</span>
          </div>

          {/* Time + Division */}
          <div className="font-cond text-[11px] text-muted tracking-wide mb-2">
            {game.scheduled_time} · {game.division}
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-1 mb-2">
            <MetaChip>
              {game.field?.name ?? `Field ${game.field_id}`}
            </MetaChip>
            {game.status !== 'Final' && (
              <button
                className="font-cond text-[10px] font-bold tracking-wide px-2 py-0.5 rounded bg-navy hover:bg-navy-light text-blue-200 transition-colors"
                onClick={e => { e.stopPropagation(); onCycleStatus(game) }}
              >
                {nextStatusLabel(game.status)}
              </button>
            )}
          </div>

          {/* Check-in progress */}
          <CheckinProgress game={game} />
        </div>
      )}
    </div>
  )
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-cond text-[10px] font-bold text-muted bg-white/5 px-1.5 py-0.5 rounded">
      {children}
    </span>
  )
}

function CheckinProgress({ game }: { game: Game }) {
  const { state } = useApp()
  const homePlayers = state.games ? 0 : 0 // placeholder — real count via checkins

  return (
    <div>
      <div className="h-1 bg-white/10 rounded overflow-hidden">
        <div className="h-full bg-green-500 rounded" style={{ width: '60%' }} />
      </div>
    </div>
  )
}

// ---- Game Detail Body ----
function GameDetailBody({
  game, homeScore, awayScore, onHomeScore, onAwayScore, onStatus
}: {
  game: Game
  homeScore: number
  awayScore: number
  onHomeScore: (v: number) => void
  onAwayScore: (v: number) => void
  onStatus: (s: GameStatus) => void
}) {
  const statuses: GameStatus[] = ['Scheduled','Starting','Live','Halftime','Final','Delayed']

  return (
    <div>
      {/* Status buttons */}
      <div className="mb-4">
        <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">STATUS</div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s => (
            <button key={s}
              onClick={() => onStatus(s)}
              className={cn(
                'font-cond text-[11px] font-bold tracking-wider px-3 py-1 rounded border transition-colors',
                game.status === s
                  ? 'bg-navy border-blue-400 text-white'
                  : 'bg-surface-card border-border text-muted hover:text-white hover:border-blue-400'
              )}>{s.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Score editor */}
      <div className="mb-4">
        <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">SCORE</div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-cond text-[10px] text-muted mb-1">{game.home_team?.name.toUpperCase()}</div>
            <input type="number" min={0} value={homeScore}
              onChange={e => onHomeScore(Number(e.target.value))}
              className="w-16 text-center font-mono text-2xl bg-surface-card border border-border text-white rounded p-1 outline-none focus:border-blue-400"
            />
          </div>
          <span className="font-cond text-2xl font-black text-muted">—</span>
          <div className="text-center">
            <div className="font-cond text-[10px] text-muted mb-1">{game.away_team?.name.toUpperCase()}</div>
            <input type="number" min={0} value={awayScore}
              onChange={e => onAwayScore(Number(e.target.value))}
              className="w-16 text-center font-mono text-2xl bg-surface-card border border-border text-white rounded p-1 outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Game info */}
      <div className="bg-surface-elevated rounded p-3 text-[12px]">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-muted font-cond font-bold">Field</span>
          <span>{game.field?.name ?? '—'}</span>
          <span className="text-muted font-cond font-bold">Time</span>
          <span className="font-mono">{game.scheduled_time}</span>
          <span className="text-muted font-cond font-bold">Division</span>
          <span>{game.division}</span>
        </div>
      </div>
    </div>
  )
}
