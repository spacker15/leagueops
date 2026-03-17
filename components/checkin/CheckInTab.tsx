'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn } from '@/components/ui'
import { cn } from '@/lib/utils'
import { createClient } from '@/supabase/client'
import type { Player, PlayerCheckin } from '@/types'
import toast from 'react-hot-toast'
import { QrCode, Printer, RefreshCw, CheckCircle, Search, AlertTriangle, XCircle, Clock, ShieldCheck } from 'lucide-react'

type Tab = 'game' | 'approvals' | 'cards'

interface PlayerWithExtras extends Player {
  usa_lacrosse_number?: string | null
  home_division?: string | null
  token?: string
}

interface PendingApproval {
  id: number
  player_id: number
  game_id: number
  first_game_id: number | null
  opposing_team_name: string
  status: string
  created_at: string
  player?: { id: number; name: string; number: number | null; team?: { name: string; division: string } }
}

interface CheckinState {
  status: 'unchecked' | 'checked' | 'pending_approval' | 'blocked_play_down' | 'blocked_max_games'
  approvalId?: number
  message?: string
  opposingTeam?: string
}

export function CheckInTab() {
  const { state } = useApp()
  const [tab, setTab]                   = useState<Tab>('game')
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [homePlayers, setHomePlayers]   = useState<PlayerWithExtras[]>([])
  const [awayPlayers, setAwayPlayers]   = useState<PlayerWithExtras[]>([])
  const [checkinStates, setCheckinStates] = useState<Record<number, CheckinState>>({})
  const [loading, setLoading]           = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [allApprovals, setAllApprovals]  = useState<PendingApproval[]>([])
  const [approvingId, setApprovingId]    = useState<number | null>(null)

  // Player cards
  const [cardTeamFilter, setCardTeamFilter] = useState('')
  const [cardSearch, setCardSearch]         = useState('')
  const [cards, setCards]                   = useState<PlayerWithExtras[]>([])
  const [cardsLoading, setCardsLoading]     = useState(false)
  const [baseUrl, setBaseUrl]               = useState('')

  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  const selectedGame = state.games.find(g => g.id === selectedGameId) ?? null

  // Load game roster with eligibility states
  useEffect(() => {
    if (!selectedGameId || !selectedGame) return
    setLoading(true)
    Promise.all([
      loadPlayers(selectedGame.home_team_id),
      loadPlayers(selectedGame.away_team_id),
      loadGameCheckins(selectedGameId),
      loadPendingForGame(selectedGameId),
    ]).then(([home, away]) => {
      setHomePlayers(home)
      setAwayPlayers(away)
      setLoading(false)
    })
  }, [selectedGameId])

  async function loadPlayers(teamId: number): Promise<PlayerWithExtras[]> {
    const sb = createClient()
    const { data } = await sb
      .from('players')
      .select('*, team:teams(name, division)')
      .eq('team_id', teamId)
      .order('name')
    return (data as PlayerWithExtras[]) ?? []
  }

  async function loadGameCheckins(gameId: number) {
    const sb = createClient()
    const { data } = await sb
      .from('player_checkins')
      .select('player_id')
      .eq('game_id', gameId)
    const checkedInIds = (data ?? []).map((c: any) => c.player_id)
    setCheckinStates(prev => {
      const next = { ...prev }
      for (const id of checkedInIds) {
        if (!next[id] || next[id].status === 'unchecked') {
          next[id] = { status: 'checked' }
        }
      }
      return next
    })
  }

  async function loadPendingForGame(gameId: number) {
    const res = await fetch(`/api/eligibility?game_id=${gameId}`)
    if (res.ok) {
      const data = await res.json() as PendingApproval[]
      setPendingApprovals(data)
      // Update states for pending approvals
      setCheckinStates(prev => {
        const next = { ...prev }
        for (const a of data) {
          next[a.player_id] = {
            status:       'pending_approval',
            approvalId:   a.id,
            message:      `Waiting for ${a.opposing_team_name} approval`,
            opposingTeam: a.opposing_team_name,
          }
        }
        return next
      })
    }
  }

  const loadAllApprovals = useCallback(async () => {
    const res = await fetch('/api/eligibility?all=1&event_id=1')
    if (res.ok) setAllApprovals(await res.json())
  }, [])

  useEffect(() => {
    if (tab === 'approvals') loadAllApprovals()
  }, [tab, loadAllApprovals])

  // Subscribe to multi_game_approvals realtime
  useEffect(() => {
    const sb = createClient()
    const sub = sb.channel('approvals-checkin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multi_game_approvals' }, () => {
        if (selectedGameId) loadPendingForGame(selectedGameId)
        loadAllApprovals()
      })
      .subscribe()
    return () => { sb.removeChannel(sub) }
  }, [selectedGameId, loadAllApprovals])

  async function togglePlayer(player: PlayerWithExtras) {
    if (!selectedGameId || !selectedGame) return
    const currentState = checkinStates[player.id] ?? { status: 'unchecked' }

    if (currentState.status === 'checked') {
      // Check out
      const sb = createClient()
      await sb.from('player_checkins').delete()
        .eq('game_id', selectedGameId).eq('player_id', player.id)
      setCheckinStates(prev => ({ ...prev, [player.id]: { status: 'unchecked' } }))
      toast('Checked out', { icon: '↩' })
      return
    }

    if (currentState.status === 'blocked_play_down') {
      toast.error(currentState.message ?? 'Play-down not allowed')
      return
    }

    if (currentState.status === 'pending_approval') {
      toast(`Waiting for ${currentState.opposingTeam} approval`, { icon: '⏳' })
      return
    }

    // Run eligibility check
    setCheckinStates(prev => ({ ...prev, [player.id]: { status: 'unchecked', message: 'Checking...' } }))

    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:         'check',
        player_id:      player.id,
        game_id:        selectedGameId,
        event_date_id:  selectedGame.event_date_id,
      }),
    })
    const result = await res.json()

    if (result.eligible === true) {
      // Check in
      const sb = createClient()
      await sb.from('player_checkins').upsert({
        game_id:       selectedGameId,
        player_id:     player.id,
        checked_in_at: new Date().toISOString(),
      })
      setCheckinStates(prev => ({ ...prev, [player.id]: { status: 'checked' } }))
      toast.success(`${player.name} checked in`)
    } else if (result.eligible === 'pending_approval') {
      setCheckinStates(prev => ({
        ...prev,
        [player.id]: {
          status:       'pending_approval',
          approvalId:   result.approvalId,
          message:      result.message,
          opposingTeam: result.opposingTeamName,
        },
      }))
      setPendingApprovals(prev => [...prev, { id: result.approvalId, player_id: player.id, game_id: selectedGameId, first_game_id: result.firstGameId, opposing_team_name: result.opposingTeamName, status: 'pending', created_at: new Date().toISOString(), player: { id: player.id, name: player.name, number: player.number ?? null } }])
      toast(`Approval needed from ${result.opposingTeamName}`, { icon: '⏳', duration: 5000 })
    } else {
      // Blocked
      const blockStatus = result.reason === 'play_down' ? 'blocked_play_down' : 'blocked_max_games'
      setCheckinStates(prev => ({
        ...prev,
        [player.id]: { status: blockStatus as any, message: result.message },
      }))
      toast.error(result.message, { duration: 5000 })
    }
  }

  async function handleApprove(approvalId: number, approverName: string, approverType: 'referee' | 'volunteer' | 'admin') {
    setApprovingId(approvalId)
    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:            'approve',
        approval_id:       approvalId,
        approved_by:       approverType,
        approved_by_name:  approverName,
      }),
    })
    if (res.ok) {
      toast.success('Multi-game approved — player checked in')
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId))
      setAllApprovals(prev => prev.filter(a => a.id !== approvalId))
      // Update checkin state
      const approval = allApprovals.find(a => a.id === approvalId) || pendingApprovals.find(a => a.id === approvalId)
      if (approval) {
        setCheckinStates(prev => ({ ...prev, [approval.player_id]: { status: 'checked' } }))
      }
    } else {
      toast.error('Approval failed')
    }
    setApprovingId(null)
  }

  async function handleDeny(approvalId: number, denierName: string) {
    setApprovingId(approvalId)
    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:     'deny',
        approval_id: approvalId,
        denied_by:  denierName,
        reason:     'Denied by official',
      }),
    })
    if (res.ok) {
      toast(`Multi-game denied`, { icon: '✗' })
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId))
      setAllApprovals(prev => prev.filter(a => a.id !== approvalId))
      const approval = allApprovals.find(a => a.id === approvalId) || pendingApprovals.find(a => a.id === approvalId)
      if (approval) {
        setCheckinStates(prev => ({ ...prev, [approval.player_id]: { status: 'blocked_play_down', message: 'Multi-game request denied' } }))
      }
    }
    setApprovingId(null)
  }

  // Player cards — load all players for event 1 via team IDs
  async function loadCards(teamId?: string) {
    setCardsLoading(true)
    const sb = createClient()

    // Get team IDs for this event first
    let teamIds: number[] = []
    if (teamId) {
      teamIds = [Number(teamId)]
    } else {
      const { data: teams } = await sb
        .from('teams')
        .select('id')
        .eq('event_id', 1)
      teamIds = (teams ?? []).map((t: any) => t.id)
    }

    if (teamIds.length === 0) { setCards([]); setCardsLoading(false); return }

    const { data } = await sb
      .from('players')
      .select('id, name, number, position, usa_lacrosse_number, home_division, team_id, team:teams(id, name, division), token:player_qr_tokens(token)')
      .in('team_id', teamIds)
      .order('name')

    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      token: Array.isArray(p.token) ? p.token[0]?.token : p.token?.token,
      team:  Array.isArray(p.team)  ? p.team[0]  : p.team,
    }))
    setCards(mapped)
    setCardsLoading(false)
  }

  useEffect(() => {
    if (tab === 'cards') loadCards(cardTeamFilter || undefined)
  }, [tab, cardTeamFilter])

  async function generateTokens() {
    const sb = createClient()
    // Get all team IDs for event 1
    const { data: teams } = await sb.from('teams').select('id').eq('event_id', 1)
    const teamIds = (teams ?? []).map((t: any) => t.id)
    if (teamIds.length === 0) { toast.error('No teams found for event'); return }
    const { data: players } = await sb.from('players').select('id').in('team_id', teamIds)
    if (players && players.length > 0) {
      for (const p of players) {
        await sb.from('player_qr_tokens').upsert(
          { player_id: p.id, event_id: 1 },
          { onConflict: 'player_id,event_id' }
        )
      }
      toast.success(`QR tokens ready for ${players.length} players`)
      loadCards(cardTeamFilter || undefined)
    } else {
      toast.error('No players found — upload rosters first')
    }
  }

  function printCards(playerList: PlayerWithExtras[]) {
    const win = window.open('', '_blank')
    if (!win) return
    const items = playerList.filter(p => p.token).map(p => {
      const team = p.team as any
      const url  = `${baseUrl}/checkin/${p.token}`
      return `<div class="card">
        <div class="card-header">
          <div class="jersey">${p.number ?? '—'}</div>
          <div class="player-info">
            <div class="player-name">${p.name}</div>
            <div class="team-name">${team?.name ?? ''}</div>
            <div class="division">${team?.division ?? ''}</div>
          </div>
        </div>
        <div class="card-body">
          <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(url)}&color=0B3D91" />
          <div class="card-details">
            ${p.usa_lacrosse_number ? `<div class="row"><span class="lbl">USA Lax #</span><span class="val">${p.usa_lacrosse_number}</span></div>` : ''}
            <div class="row"><span class="lbl">Jersey</span><span class="val">#${p.number ?? '—'}</span></div>
            ${p.position ? `<div class="row"><span class="lbl">Pos</span><span class="val">${p.position}</span></div>` : ''}
            ${(p.home_division || (team?.division)) ? `<div class="row"><span class="lbl">Division</span><span class="val">${p.home_division || team?.division}</span></div>` : ''}
            <div class="scan">📱 Scan to check in</div>
          </div>
        </div>
      </div>`
    }).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>Player Cards</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:16px}h2{font-size:13px;margin-bottom:12px;color:#333}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .card{border:2px solid #0B3D91;border-radius:8px;overflow:hidden;page-break-inside:avoid}
    .card-header{background:#0B3D91;color:white;padding:8px 10px;display:flex;align-items:center;gap:8px}
    .jersey{width:34px;height:34px;background:#D62828;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0}
    .player-name{font-weight:900;font-size:12px}.team-name{font-size:10px;opacity:.85}.division{font-size:9px;opacity:.7}
    .card-body{display:flex;gap:8px;padding:8px 10px;background:#f8f9ff}
    .qr{width:80px;height:80px;flex-shrink:0;border-radius:3px}
    .row{display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px;border-bottom:1px solid #e5e7eb;padding-bottom:2px}
    .lbl{color:#6b7280;font-weight:700}.val{color:#111;font-weight:700}
    .scan{color:#0B3D91;font-size:9px;text-align:center;margin-top:4px}
    @media print{@page{margin:.5cm}}</style></head>
    <body><h2>LeagueOps Player Check-In Cards</h2><div class="grid">${items}</div></body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const filteredCards = cards.filter(p => {
    if (!cardSearch) return true
    const q = cardSearch.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.usa_lacrosse_number ?? '').includes(q) || String(p.number ?? '').includes(q)
  })

  const totalPlayers = homePlayers.length + awayPlayers.length
  const checkedCount = Object.values(checkinStates).filter(s => s.status === 'checked').length
  const pendingCount = pendingApprovals.length

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {[
          { id: 'game',      label: 'Game Check-In' },
          { id: 'approvals', label: allApprovals.length > 0 ? `Approvals (${allApprovals.length})` : 'Approvals' },
          { id: 'cards',     label: 'Player Cards & QR' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              tab === t.id ? 'border-red text-white' : 'border-transparent text-muted hover:text-white',
              t.id === 'approvals' && allApprovals.length > 0 && tab !== t.id && 'text-yellow-400'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GAME CHECK-IN ── */}
      {tab === 'game' && (
        <div>
          <div className="flex gap-3 items-center mb-4 flex-wrap">
            <select
              className="bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[13px] font-bold outline-none focus:border-blue-400"
              value={selectedGameId ?? ''}
              onChange={e => setSelectedGameId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a game…</option>
              {state.games.map(g => (
                <option key={g.id} value={g.id}>
                  #{g.id} · {g.scheduled_time} · {g.home_team?.name ?? '?'} vs {g.away_team?.name ?? '?'} ({g.field?.name ?? `F${g.field_id}`})
                </option>
              ))}
            </select>

            {selectedGameId && totalPlayers > 0 && (
              <div className="flex items-center gap-3">
                <div className={cn('font-mono text-xl font-bold', checkedCount === totalPlayers ? 'text-green-400' : checkedCount >= totalPlayers * 0.5 ? 'text-yellow-400' : 'text-red-400')}>
                  {checkedCount}/{totalPlayers}
                </div>
                <div className="font-cond text-[11px] text-muted">checked in</div>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-1.5 font-cond text-[11px] text-yellow-400 font-bold">
                    <Clock size={12} />
                    {pendingCount} PENDING APPROVAL
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pending approvals for this game */}
          {pendingApprovals.length > 0 && (
            <div className="bg-yellow-900/15 border border-yellow-800/40 rounded-xl p-4 mb-4">
              <div className="font-cond font-black text-[12px] tracking-wide text-yellow-400 mb-3 flex items-center gap-2">
                <Clock size={14} /> AWAITING OPPOSING COACH APPROVAL ({pendingApprovals.length})
              </div>
              <div className="space-y-2">
                {pendingApprovals.map(a => (
                  <ApprovalRow
                    key={a.id}
                    approval={a}
                    applying={approvingId === a.id}
                    onApprove={(name, type) => handleApprove(a.id, name, type)}
                    onDeny={(name) => handleDeny(a.id, name)}
                    context="game"
                  />
                ))}
              </div>
            </div>
          )}

          {loading && <div className="text-center py-12 text-muted font-cond">LOADING ROSTERS...</div>}

          {!loading && selectedGame && (
            <div className="grid grid-cols-2 gap-4">
              <RosterPanel label={selectedGame.home_team?.name ?? 'Home'} players={homePlayers} states={checkinStates} onToggle={p => togglePlayer(p)} />
              <RosterPanel label={selectedGame.away_team?.name ?? 'Away'} players={awayPlayers} states={checkinStates} onToggle={p => togglePlayer(p)} />
            </div>
          )}

          {!selectedGameId && (
            <div className="text-center py-16 text-muted font-cond font-bold tracking-widest">SELECT A GAME TO CHECK IN PLAYERS</div>
          )}
        </div>
      )}

      {/* ── APPROVALS ── */}
      {tab === 'approvals' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="font-cond font-black text-[14px] text-white mb-0.5">MULTI-GAME APPROVAL REQUESTS</div>
              <div className="font-cond text-[11px] text-muted">
                Players appearing in more than one game today require the opposing team's approval.
                Refs and volunteers can approve on behalf of the coach.
              </div>
            </div>
            <Btn size="sm" variant="ghost" onClick={loadAllApprovals}>
              <RefreshCw size={11} className="inline mr-1" /> REFRESH
            </Btn>
          </div>

          {allApprovals.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <ShieldCheck size={48} className="text-green-400" />
              <div className="font-cond font-black text-[18px] text-green-400">NO PENDING APPROVALS</div>
              <div className="font-cond text-[12px] text-muted">All multi-game requests have been resolved</div>
            </div>
          ) : (
            <div className="space-y-3">
              {allApprovals.map(a => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  applying={approvingId === a.id}
                  onApprove={(name, type) => handleApprove(a.id, name, type)}
                  onDeny={(name) => handleDeny(a.id, name)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PLAYER CARDS ── */}
      {tab === 'cards' && (
        <div>
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <select
              className="bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[12px] font-bold outline-none focus:border-blue-400"
              value={cardTeamFilter}
              onChange={e => setCardTeamFilter(e.target.value)}
            >
              <option value="">All Teams ({cards.length} players)</option>
              {state.teams.map(t => {
                const count = cards.filter(c => (c.team as any)?.id === t.id || (c as any).team_id === t.id).length
                return <option key={t.id} value={t.id}>{t.name} ({count})</option>
              })}
            </select>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="bg-surface-card border border-border text-white pl-7 pr-3 py-2 rounded text-[12px] outline-none focus:border-blue-400 w-48"
                placeholder="Search name / USA Lax #" value={cardSearch} onChange={e => setCardSearch(e.target.value)} />
            </div>
            <div className="ml-auto flex gap-2">
              <Btn size="sm" variant="ghost" onClick={generateTokens}><RefreshCw size={11} className="inline mr-1" /> GENERATE QR</Btn>
              <Btn size="sm" variant="primary" onClick={() => printCards(filteredCards)}><Printer size={11} className="inline mr-1" /> PRINT CARDS</Btn>
            </div>
          </div>
          {cardsLoading ? (
            <div className="text-center py-12 text-muted font-cond">LOADING...</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {filteredCards.map(p => <PlayerCard key={p.id} player={p} baseUrl={baseUrl} onPrint={() => printCards([p])} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Roster panel ─────────────────────────────────────────────
function RosterPanel({ label, players, states, onToggle }: {
  label: string; players: PlayerWithExtras[]
  states: Record<number, CheckinState>; onToggle: (p: PlayerWithExtras) => void
}) {
  const checkedCount = players.filter(p => states[p.id]?.status === 'checked').length
  return (
    <div className="bg-surface-card border border-border rounded-lg overflow-hidden">
      <div className="bg-navy/60 px-4 py-2.5 border-b border-border flex justify-between items-center">
        <div className="font-cond font-black text-[14px] text-white">{label}</div>
        <div className={cn('font-mono text-[18px] font-bold',
          checkedCount === players.length && players.length > 0 ? 'text-green-400' :
          checkedCount > 0 ? 'text-yellow-400' : 'text-muted'
        )}>{checkedCount}/{players.length}</div>
      </div>
      {players.length === 0 ? (
        <div className="p-4 text-center text-muted font-cond text-[12px]">No roster uploaded</div>
      ) : (
        <div className="divide-y divide-border/40">
          {players.map(p => {
            const s = states[p.id] ?? { status: 'unchecked' }
            return (
              <button key={p.id} onClick={() => onToggle(p)}
                className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  s.status === 'checked'          ? 'bg-green-900/15 hover:bg-green-900/20' :
                  s.status === 'pending_approval' ? 'bg-yellow-900/10 hover:bg-yellow-900/15' :
                  s.status === 'blocked_play_down' ? 'bg-red-900/10 cursor-not-allowed' :
                  'hover:bg-white/5'
                )}>
                {/* Jersey # */}
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-cond font-black text-[13px] flex-shrink-0',
                  s.status === 'checked'          ? 'bg-green-700 text-white' :
                  s.status === 'pending_approval' ? 'bg-yellow-700 text-white' :
                  s.status === 'blocked_play_down' ? 'bg-red-900/50 text-red-400' :
                  'bg-navy text-muted'
                )}>{p.number ?? '—'}</div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className={cn('font-cond font-bold text-[13px] leading-tight',
                    s.status === 'checked'           ? 'text-green-300' :
                    s.status === 'pending_approval'  ? 'text-yellow-300' :
                    s.status === 'blocked_play_down' ? 'text-red-400' :
                    'text-white'
                  )}>{p.name}</div>
                  {s.status === 'pending_approval' && <div className="font-cond text-[9px] text-yellow-400">⏳ {s.message}</div>}
                  {s.status === 'blocked_play_down' && <div className="font-cond text-[9px] text-red-400">⛔ {s.message}</div>}
                  {p.usa_lacrosse_number && s.status !== 'blocked_play_down' && (
                    <div className="font-mono text-[9px] text-muted">USA #{p.usa_lacrosse_number}</div>
                  )}
                </div>

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {s.status === 'checked'           && <CheckCircle size={16} className="text-green-400" />}
                  {s.status === 'pending_approval'  && <Clock size={16} className="text-yellow-400" />}
                  {s.status === 'blocked_play_down' && <XCircle size={16} className="text-red-400" />}
                  {s.status === 'unchecked'         && <div className="w-4 h-4 rounded-full border-2 border-border" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Compact approval row (inside game view) ──────────────────
function ApprovalRow({ approval, applying, onApprove, onDeny, context }: {
  approval: PendingApproval; applying: boolean
  onApprove: (name: string, type: 'referee' | 'volunteer' | 'admin') => void
  onDeny: (name: string) => void; context: 'game' | 'list'
}) {
  const [approverName, setApproverName]   = useState('')
  const [approverType, setApproverType]   = useState<'referee' | 'volunteer' | 'admin'>('referee')
  const [coachName, setCoachName]         = useState('')
  const p = approval.player

  function fullApproverName() {
    const parts = [approverName]
    if (coachName) parts.push(`(Coach: ${coachName})`)
    return parts.join(' ')
  }

  return (
    <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3">
      <div className="font-cond font-bold text-[13px] text-yellow-300 mb-0.5">
        {p?.name ?? `Player #${approval.player_id}`}
      </div>
      <div className="font-cond text-[11px] text-muted mb-2">
        Playing 2nd game — <span className="text-white">{approval.opposing_team_name}</span> coach approval needed
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-1">YOUR NAME (REF/VOL)</div>
          <input
            className="w-full bg-surface border border-border text-white px-2 py-1.5 rounded text-[11px] outline-none focus:border-blue-400"
            placeholder="e.g. Mike Johnson" value={approverName}
            onChange={e => setApproverName(e.target.value)}
          />
        </div>
        <div>
          <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-1">COACH WHO APPROVED (optional)</div>
          <input
            className="w-full bg-surface border border-border text-white px-2 py-1.5 rounded text-[11px] outline-none focus:border-blue-400"
            placeholder="Coach name" value={coachName}
            onChange={e => setCoachName(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <select className="bg-surface border border-border text-white px-1.5 py-1.5 rounded text-[10px] outline-none flex-shrink-0"
          value={approverType} onChange={e => setApproverType(e.target.value as any)}>
          <option value="referee">Referee</option>
          <option value="volunteer">Volunteer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={() => { if (approverName) onApprove(fullApproverName(), approverType); else toast.error('Enter your name') }}
          disabled={applying}
          className="flex-1 font-cond text-[11px] font-bold py-1.5 rounded bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50">
          {applying ? '...' : '✓ APPROVE & CHECK IN'}
        </button>
        <button onClick={() => onDeny(approverName || 'Official')}
          className="font-cond text-[11px] font-bold px-3 py-1.5 rounded bg-surface-card border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors">
          ✗ DENY
        </button>
      </div>
    </div>
  )
}

// ─── Full approval card (approvals tab) ───────────────────────
function ApprovalCard({ approval, applying, onApprove, onDeny }: {
  approval: PendingApproval; applying: boolean
  onApprove: (name: string, type: 'referee' | 'volunteer' | 'admin') => void
  onDeny: (name: string) => void
}) {
  const [approverName, setApproverName] = useState('')
  const [approverType, setApproverType] = useState<'referee' | 'volunteer' | 'admin'>('referee')
  const [coachName, setCoachName]       = useState('')
  const p    = approval.player
  const team = (p as any)?.team as any

  function fullName() {
    return coachName ? `${approverName} (Coach: ${coachName})` : approverName
  }

  return (
    <div className="bg-surface-card border border-yellow-800/40 rounded-xl p-4">
      {/* Player info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center font-cond font-black text-[14px] text-yellow-300 flex-shrink-0">
          {p?.number ?? '?'}
        </div>
        <div className="flex-1">
          <div className="font-cond font-black text-[15px] text-white">{p?.name ?? `Player #${approval.player_id}`}</div>
          <div className="font-cond text-[11px] text-blue-300">{team?.name} · {team?.division}</div>
        </div>
        <div className="font-cond text-[10px] text-muted text-right">
          Game #{approval.game_id}<br/>
          {new Date(approval.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      <div className="bg-yellow-900/15 rounded-lg px-3 py-2 text-[11px] font-cond mb-3">
        <span className="text-yellow-400 font-bold">Multi-game: </span>
        <span className="text-muted">Already played Game #{approval.first_game_id} today. </span>
        <span className="text-white font-bold">{approval.opposing_team_name}</span>
        <span className="text-muted"> coach must approve.</span>
      </div>

      {/* Approval form */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-1">YOUR NAME *</div>
          <input className="w-full bg-surface border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
            placeholder="Referee or volunteer name" value={approverName}
            onChange={e => setApproverName(e.target.value)} />
        </div>
        <div>
          <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-1">COACH WHO APPROVED (optional)</div>
          <input className="w-full bg-surface border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
            placeholder="Opposing coach name" value={coachName}
            onChange={e => setCoachName(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <select className="bg-surface border border-border text-white px-2 py-2 rounded text-[11px] outline-none flex-shrink-0"
          value={approverType} onChange={e => setApproverType(e.target.value as any)}>
          <option value="referee">Referee</option>
          <option value="volunteer">Volunteer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={() => { if (approverName) onApprove(fullName(), approverType); else toast.error('Enter your name') }}
          disabled={applying}
          className="flex-1 font-cond text-[12px] font-bold py-2 rounded bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50">
          {applying ? 'APPROVING...' : '✓ APPROVE & CHECK IN'}
        </button>
        <button onClick={() => onDeny(approverName || 'Official')} disabled={applying}
          className="font-cond text-[12px] font-bold px-4 py-2 rounded bg-surface-card border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50">
          ✗ DENY
        </button>
      </div>
    </div>
  )
}

// ─── Player Card ───────────────────────────────────────────────
function PlayerCard({ player, baseUrl, onPrint }: { player: PlayerWithExtras; baseUrl: string; onPrint: () => void }) {
  const team = player.team as any
  const checkinUrl = player.token ? `${baseUrl}/checkin/${player.token}` : null
  const qrUrl = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(checkinUrl)}&color=0B3D91&bgcolor=FFFFFF`
    : null

  return (
    <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-navy px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-red flex items-center justify-center font-cond font-black text-[14px] text-white flex-shrink-0">
            {player.number ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="font-cond font-black text-[13px] text-white leading-tight truncate">{player.name}</div>
            <div className="font-cond text-[10px] text-blue-300 truncate">{team?.name ?? '—'}</div>
            <div className="font-cond text-[9px] text-muted">{team?.division ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* QR code — clickable to open check-in */}
      <div className="p-3">
        {qrUrl ? (
          <a href={checkinUrl!} target="_blank" rel="noopener noreferrer" title="Click to open check-in page">
            <img
              src={qrUrl}
              alt={`QR code for ${player.name}`}
              className="w-full aspect-square rounded-lg border border-border bg-white p-2 hover:opacity-80 transition-opacity cursor-pointer"
            />
          </a>
        ) : (
          <div className="w-full aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2">
            <QrCode size={32} className="text-muted" />
            <div className="font-cond text-[9px] text-muted text-center">Click GENERATE QR CODES above</div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-3 pb-2 space-y-1">
        {player.usa_lacrosse_number && (
          <div className="flex justify-between items-center">
            <span className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase">USA LAX #</span>
            <span className="font-mono text-[11px] font-bold text-white">{player.usa_lacrosse_number}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase">JERSEY</span>
          <span className="font-mono text-[11px] font-bold text-white">#{player.number ?? '—'}</span>
        </div>
        {(player.home_division || team?.division) && (
          <div className="flex justify-between items-center">
            <span className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase">DIVISION</span>
            <span className="font-cond text-[11px] text-white">{player.home_division || team?.division}</span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 flex gap-1.5">
        {checkinUrl ? (
          <>
            <a href={checkinUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 font-cond text-[10px] font-bold tracking-wide py-1.5 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors text-center">
              CHECK IN
            </a>
            <button onClick={onPrint}
              className="font-cond text-[10px] font-bold tracking-wide px-2 py-1.5 rounded bg-navy hover:bg-navy-light text-white transition-colors">
              <Printer size={10} />
            </button>
          </>
        ) : (
          <div className="flex-1 font-cond text-[9px] text-muted text-center py-1.5">
            Generate QR codes first
          </div>
        )}
      </div>
    </div>
  )
}
