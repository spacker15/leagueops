'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/lib/store'
import { Btn } from '@/components/ui'
import { cn } from '@/lib/utils'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { Printer, CheckCircle, Search, XCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react'

type Tab = 'game' | 'approvals'
type ViewMode = 'list' | 'cards'

interface PlayerWithExtras {
  id: number
  name: string
  number: number | null
  position: string | null
  usa_lacrosse_number?: string | null
  home_division?: string | null
  team_id?: number
  team?: { id: number; name: string; division: string }
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
  player?: {
    id: number
    name: string
    number: number | null
    team?: { name: string; division: string }
  }
}

interface CheckinState {
  status: 'unchecked' | 'checked' | 'pending_approval' | 'blocked_play_down' | 'blocked_max_games'
  approvalId?: number
  message?: string
  opposingTeam?: string
}

// ─── Auto-generate QR tokens for a list of player IDs ─────────
async function ensureTokens(playerIds: number[], eventId: number): Promise<Record<number, string>> {
  if (!playerIds.length) return {}
  const sb = createClient()
  // Upsert tokens silently
  await Promise.all(
    playerIds.map((id) =>
      sb
        .from('player_qr_tokens')
        .upsert({ player_id: id, event_id: eventId }, { onConflict: 'player_id,event_id' })
    )
  )
  // Fetch back tokens
  const { data } = await sb
    .from('player_qr_tokens')
    .select('player_id, token')
    .in('player_id', playerIds)
  const map: Record<number, string> = {}
  for (const row of data ?? []) map[(row as any).player_id] = (row as any).token
  return map
}

export function CheckInTab() {
  const { state, eventId } = useApp()
  if (!eventId) return null
  const { userRole } = useAuth()

  const [tab, setTab] = useState<Tab>('game')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [homePlayers, setHomePlayers] = useState<PlayerWithExtras[]>([])
  const [awayPlayers, setAwayPlayers] = useState<PlayerWithExtras[]>([])
  const [checkinStates, setCheckinStates] = useState<Record<number, CheckinState>>({})
  const [loading, setLoading] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [allApprovals, setAllApprovals] = useState<PendingApproval[]>([])
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [cardSearch, setCardSearch] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null)
  const [leagueName, setLeagueName] = useState('LeagueOps')

  const approverName = userRole?.display_name ?? 'Staff'
  const approverType: 'referee' | 'volunteer' | 'admin' =
    userRole?.role === 'admin' || userRole?.role === 'league_admin'
      ? 'admin'
      : userRole?.role === 'referee'
        ? 'referee'
        : userRole?.role === 'volunteer'
          ? 'volunteer'
          : 'admin'

  useEffect(() => {
    setBaseUrl(window.location.origin)
    // Load league info
    const sb = createClient()
    sb.from('events')
      .select('name, logo_url')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setLeagueName((data as any).name ?? 'LeagueOps')
          setLeagueLogo((data as any).logo_url ?? null)
        }
      })
  }, [])

  const selectedGame = state.games.find((g) => g.id === selectedGameId) ?? null

  useEffect(() => {
    if (!selectedGameId || !selectedGame) return
    setLoading(true)
    setCheckinStates({})
    setHomePlayers([])
    setAwayPlayers([])
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
      .select(
        'id, name, number, position, usa_lacrosse_number, home_division, team_id, team:teams(id, name, division)'
      )
      .eq('team_id', teamId)
      .order('name')

    const players = (data ?? []).map((p: any) => ({
      ...p,
      team: Array.isArray(p.team) ? p.team[0] : p.team,
    })) as PlayerWithExtras[]

    if (!players.length) return players

    // Auto-generate tokens for any missing ones
    const tokenMap = await ensureTokens(players.map((p) => p.id), eventId)
    return players.map((p) => ({ ...p, token: tokenMap[p.id] }))
  }

  async function loadGameCheckins(gameId: number) {
    const sb = createClient()
    const { data } = await sb.from('player_checkins').select('player_id').eq('game_id', gameId)
    const ids = (data ?? []).map((c: any) => c.player_id)
    setCheckinStates((prev) => {
      const next = { ...prev }
      for (const id of ids)
        if (!next[id] || next[id].status === 'unchecked') next[id] = { status: 'checked' }
      return next
    })
  }

  async function loadPendingForGame(gameId: number) {
    const res = await fetch(`/api/eligibility?game_id=${gameId}`)
    if (!res.ok) return
    const data = (await res.json()) as PendingApproval[]
    setPendingApprovals(data)
    setCheckinStates((prev) => {
      const next = { ...prev }
      for (const a of data) {
        next[a.player_id] = {
          status: 'pending_approval',
          approvalId: a.id,
          message: `Waiting for ${a.opposing_team_name} approval`,
          opposingTeam: a.opposing_team_name,
        }
      }
      return next
    })
  }

  const loadAllApprovals = useCallback(async () => {
    const res = await fetch(`/api/eligibility?all=1&event_id=${eventId}`)
    if (res.ok) setAllApprovals(await res.json())
  }, [])

  useEffect(() => {
    if (tab === 'approvals') loadAllApprovals()
  }, [tab, loadAllApprovals])

  useEffect(() => {
    const sb = createClient()
    const sub = sb
      .channel('checkin-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'multi_game_approvals' },
        () => {
          if (selectedGameId) loadPendingForGame(selectedGameId)
          loadAllApprovals()
        }
      )
      .subscribe()
    return () => {
      sb.removeChannel(sub)
    }
  }, [selectedGameId, loadAllApprovals])

  async function togglePlayer(player: PlayerWithExtras) {
    if (!selectedGameId || !selectedGame) return
    const s = checkinStates[player.id] ?? { status: 'unchecked' }
    if (s.status === 'checked') {
      const sb = createClient()
      await sb
        .from('player_checkins')
        .delete()
        .eq('game_id', selectedGameId)
        .eq('player_id', player.id)
      setCheckinStates((prev) => ({ ...prev, [player.id]: { status: 'unchecked' } }))
      toast('Checked out', { icon: '↩' })
      return
    }
    if (s.status === 'blocked_play_down') {
      toast.error(s.message ?? 'Not eligible')
      return
    }
    if (s.status === 'pending_approval') {
      toast(`Waiting for ${s.opposingTeam} approval`, { icon: '⏳' })
      return
    }

    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check',
        player_id: player.id,
        game_id: selectedGameId,
        event_date_id: selectedGame.event_date_id,
      }),
    })
    const result = await res.json()

    if (result.eligible === true) {
      const sb = createClient()
      await sb.from('player_checkins').upsert({
        game_id: selectedGameId,
        player_id: player.id,
        checked_in_at: new Date().toISOString(),
      })
      setCheckinStates((prev) => ({ ...prev, [player.id]: { status: 'checked' } }))
      toast.success(`${player.name} checked in`)
    } else if (result.eligible === 'pending_approval') {
      setCheckinStates((prev) => ({
        ...prev,
        [player.id]: {
          status: 'pending_approval',
          approvalId: result.approvalId,
          message: result.message,
          opposingTeam: result.opposingTeamName,
        },
      }))
      setPendingApprovals((prev) => [
        ...prev,
        {
          id: result.approvalId,
          player_id: player.id,
          game_id: selectedGameId,
          first_game_id: result.firstGameId,
          opposing_team_name: result.opposingTeamName,
          status: 'pending',
          created_at: new Date().toISOString(),
          player: { id: player.id, name: player.name, number: player.number ?? null },
        },
      ])
      toast(`Needs ${result.opposingTeamName} approval`, { icon: '⏳', duration: 5000 })
    } else {
      setCheckinStates((prev) => ({
        ...prev,
        [player.id]: { status: 'blocked_play_down', message: result.message },
      }))
      toast.error(result.message, { duration: 5000 })
    }
  }

  async function handleApprove(approvalId: number, coachName: string) {
    setApprovingId(approvalId)
    const displayName = coachName ? `${approverName} (Coach: ${coachName})` : approverName
    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        approval_id: approvalId,
        approved_by: approverType,
        approved_by_name: displayName,
      }),
    })
    if (res.ok) {
      toast.success('Approved — player checked in')
      const a = [...pendingApprovals, ...allApprovals].find((x) => x.id === approvalId)
      if (a) setCheckinStates((prev) => ({ ...prev, [a.player_id]: { status: 'checked' } }))
      setPendingApprovals((prev) => prev.filter((x) => x.id !== approvalId))
      setAllApprovals((prev) => prev.filter((x) => x.id !== approvalId))
    } else toast.error('Approval failed')
    setApprovingId(null)
  }

  async function handleDeny(approvalId: number) {
    setApprovingId(approvalId)
    await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deny',
        approval_id: approvalId,
        denied_by: approverName,
        reason: 'Denied by official',
      }),
    })
    toast('Denied', { icon: '✗' })
    const a = [...pendingApprovals, ...allApprovals].find((x) => x.id === approvalId)
    if (a)
      setCheckinStates((prev) => ({
        ...prev,
        [a.player_id]: { status: 'blocked_play_down', message: 'Multi-game request denied' },
      }))
    setPendingApprovals((prev) => prev.filter((x) => x.id !== approvalId))
    setAllApprovals((prev) => prev.filter((x) => x.id !== approvalId))
    setApprovingId(null)
  }

  function printCards(players: PlayerWithExtras[]) {
    const win = window.open('', '_blank')
    if (!win) return
    const logoHtml = leagueLogo
      ? `<img src="${leagueLogo}" class="logo" />`
      : `<div class="logo-text">${leagueName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 3)}</div>`

    const items = players
      .filter((p) => p.token)
      .map((p) => {
        const team = p.team as any
        const url = `${baseUrl}/checkin/${p.token}`
        return `<div class="card">
        <div class="card-header">
          <div class="logo-wrap">${logoHtml}</div>
          <div class="jersey-circle">${p.number ?? '?'}</div>
          <div class="player-info">
            <div class="player-name">${p.name}</div>
            <div class="team-name">${team?.name ?? ''}</div>
            <div class="division">${team?.division ?? ''}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="qr-wrap">
            <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&color=0B3D91&bgcolor=FFFFFF" />
            <div class="scan-hint">📱 Scan to check in</div>
          </div>
          <div class="details">
            ${p.usa_lacrosse_number ? `<div class="detail-row"><span class="dl">USA LAX #</span><span class="dv">${p.usa_lacrosse_number}</span></div>` : ''}
            <div class="detail-row"><span class="dl">JERSEY</span><span class="dv">#${p.number ?? '—'}</span></div>
            ${p.position ? `<div class="detail-row"><span class="dl">POSITION</span><span class="dv">${p.position}</span></div>` : ''}
            <div class="detail-row"><span class="dl">DIVISION</span><span class="dv">${team?.division ?? '—'}</span></div>
            <div class="event-name">${leagueName}</div>
          </div>
        </div>
      </div>`
      })
      .join('')

    win.document.write(`<!DOCTYPE html><html><head><title>Player Cards</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 14px; background: white; }
      h2 { font-size: 13px; margin-bottom: 12px; color: #333; font-weight: bold; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .card { border: 2.5px solid #0B3D91; border-radius: 10px; overflow: hidden; page-break-inside: avoid; }
      .card-header { background: #0B3D91; color: white; padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
      .logo-wrap { width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      .logo { width: 36px; height: 36px; object-fit: contain; border-radius: 4px; background: white; padding: 2px; }
      .logo-text { width: 36px; height: 36px; background: #D62828; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; color: white; }
      .jersey-circle { width: 38px; height: 38px; background: #D62828; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900; color: white; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.3); }
      .player-name { font-weight: 900; font-size: 14px; line-height: 1.2; }
      .team-name { font-size: 11px; opacity: 0.9; margin-top: 1px; font-weight: bold; }
      .division { font-size: 10px; opacity: 0.75; }
      .card-body { display: flex; gap: 10px; padding: 10px 12px; background: #f0f4ff; }
      .qr-wrap { flex-shrink: 0; text-align: center; }
      .qr { width: 110px; height: 110px; border-radius: 6px; border: 2px solid #0B3D91; display: block; }
      .scan-hint { font-size: 9px; color: #0B3D91; margin-top: 4px; font-weight: bold; text-align: center; }
      .details { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
      .detail-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
      .dl { font-size: 9px; color: #64748b; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
      .dv { font-size: 13px; color: #0f172a; font-weight: 900; }
      .event-name { font-size: 9px; color: #0B3D91; font-weight: bold; margin-top: 6px; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 4px; }
      @media print { @page { margin: 0.5cm; size: letter; } .grid { gap: 8px; } }
    </style>
    </head><body>
      <h2>Player Check-In Cards — ${leagueName}</h2>
      <div class="grid">${items}</div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const allPlayers = [...homePlayers, ...awayPlayers]
  const checkedCount = Object.values(checkinStates).filter((s) => s.status === 'checked').length
  const totalPlayers = allPlayers.length
  const pendingCount = pendingApprovals.length

  const filteredHome = cardSearch
    ? homePlayers.filter((p) => {
        const q = cardSearch.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          String(p.number ?? '').includes(q) ||
          (p.usa_lacrosse_number ?? '').includes(q)
        )
      })
    : homePlayers

  const filteredAway = cardSearch
    ? awayPlayers.filter((p) => {
        const q = cardSearch.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          String(p.number ?? '').includes(q) ||
          (p.usa_lacrosse_number ?? '').includes(q)
        )
      })
    : awayPlayers

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {[
          { id: 'game', label: 'Check-In & Player Cards' },
          {
            id: 'approvals',
            label: allApprovals.length > 0 ? `Approvals (${allApprovals.length})` : 'Approvals',
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              tab === t.id
                ? 'border-red text-white'
                : 'border-transparent text-muted hover:text-white',
              t.id === 'approvals' && allApprovals.length > 0 && tab !== t.id && 'text-yellow-400'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GAME CHECK-IN + PLAYER CARDS ── */}
      {tab === 'game' && (
        <div>
          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <select
              className="bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[13px] font-bold outline-none focus:border-blue-400"
              value={selectedGameId ?? ''}
              onChange={(e) => setSelectedGameId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a game…</option>
              {state.games.map((g) => (
                <option key={g.id} value={g.id}>
                  #{g.id} · {g.scheduled_time} · {g.home_team?.name ?? '?'} vs{' '}
                  {g.away_team?.name ?? '?'} ({g.field?.name ?? `F${g.field_id}`})
                </option>
              ))}
            </select>

            {selectedGameId && totalPlayers > 0 && (
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'font-mono text-xl font-bold',
                    checkedCount === totalPlayers
                      ? 'text-green-400'
                      : checkedCount > 0
                        ? 'text-yellow-400'
                        : 'text-muted'
                  )}
                >
                  {checkedCount}/{totalPlayers}
                </div>
                <div className="h-2 w-24 bg-white/10 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${totalPlayers ? (checkedCount / totalPlayers) * 100 : 0}%`,
                      background: checkedCount === totalPlayers ? '#22c55e' : '#facc15',
                    }}
                  />
                </div>
                {pendingCount > 0 && (
                  <span className="font-cond text-[11px] font-bold text-yellow-400 flex items-center gap-1">
                    <Clock size={11} /> {pendingCount} PENDING
                  </span>
                )}
              </div>
            )}

            <div className="ml-auto flex gap-2 items-center">
              {/* View toggle */}
              <div className="flex rounded overflow-hidden border border-border">
                {(['list', 'cards'] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    className={cn(
                      'font-cond text-[11px] font-bold px-3 py-1.5 transition-colors',
                      viewMode === v
                        ? 'bg-navy text-white'
                        : 'bg-surface-card text-muted hover:text-white'
                    )}
                  >
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>

              {viewMode === 'cards' && (
                <div className="relative">
                  <Search
                    size={11}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    className="bg-surface-card border border-border text-white pl-7 pr-3 py-1.5 rounded text-[12px] outline-none focus:border-blue-400 w-40"
                    placeholder="Name / # / USA Lax"
                    value={cardSearch}
                    onChange={(e) => setCardSearch(e.target.value)}
                  />
                </div>
              )}

              {allPlayers.length > 0 && (
                <Btn size="sm" variant="ghost" onClick={() => printCards(allPlayers)}>
                  <Printer size={11} className="inline mr-1" /> PRINT ALL
                </Btn>
              )}
            </div>
          </div>

          {/* Pending approvals */}
          {pendingApprovals.length > 0 && (
            <div className="bg-yellow-900/15 border border-yellow-800/40 rounded-xl p-4 mb-4 space-y-2">
              <div className="font-cond font-black text-[12px] text-yellow-400 flex items-center gap-2 mb-2">
                <Clock size={13} /> AWAITING APPROVAL — as{' '}
                <span className="text-white ml-1">{approverName}</span>
              </div>
              {pendingApprovals.map((a) => (
                <ApprovalRow
                  key={a.id}
                  approval={a}
                  applying={approvingId === a.id}
                  approverName={approverName}
                  onApprove={(coachName) => handleApprove(a.id, coachName)}
                  onDeny={() => handleDeny(a.id)}
                />
              ))}
            </div>
          )}

          {loading && (
            <div className="text-center py-12 text-muted font-cond">LOADING ROSTERS...</div>
          )}

          {!loading && !selectedGameId && (
            <div className="text-center py-16 text-muted font-cond font-bold tracking-widest">
              SELECT A GAME TO CHECK IN PLAYERS
            </div>
          )}

          {!loading && selectedGame && (
            <>
              {/* ── LIST VIEW ── */}
              {viewMode === 'list' && (
                <div className="grid grid-cols-2 gap-4">
                  <RosterList
                    label={selectedGame.home_team?.name ?? 'Home'}
                    players={homePlayers}
                    states={checkinStates}
                    onToggle={togglePlayer}
                    onPrintTeam={() => printCards(homePlayers)}
                  />
                  <RosterList
                    label={selectedGame.away_team?.name ?? 'Away'}
                    players={awayPlayers}
                    states={checkinStates}
                    onToggle={togglePlayer}
                    onPrintTeam={() => printCards(awayPlayers)}
                  />
                </div>
              )}

              {/* ── CARDS VIEW ── */}
              {viewMode === 'cards' && (
                <div>
                  {[
                    { label: selectedGame.home_team?.name ?? 'Home', players: filteredHome },
                    { label: selectedGame.away_team?.name ?? 'Away', players: filteredAway },
                  ].map(({ label, players }) => (
                    <div key={label} className="mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="font-cond font-black text-[14px] tracking-wide text-white">
                          {label}
                        </div>
                        <div
                          className={cn(
                            'font-cond text-[12px] font-bold',
                            players.filter((p) => checkinStates[p.id]?.status === 'checked')
                              .length === players.length && players.length > 0
                              ? 'text-green-400'
                              : 'text-muted'
                          )}
                        >
                          {players.filter((p) => checkinStates[p.id]?.status === 'checked').length}/
                          {players.length} checked in
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => printCards(players)}>
                          <Printer size={10} className="inline mr-1" /> PRINT TEAM
                        </Btn>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3">
                        {players.map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            state={checkinStates[p.id] ?? { status: 'unchecked' }}
                            baseUrl={baseUrl}
                            leagueLogo={leagueLogo}
                            onToggle={() => togglePlayer(p)}
                            onPrint={() => printCards([p])}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── APPROVALS ── */}
      {tab === 'approvals' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="font-cond font-black text-[14px] text-white mb-0.5">
                MULTI-GAME APPROVAL REQUESTS
              </div>
              <div className="font-cond text-[11px] text-muted">
                Approving as: <span className="text-white font-bold">{approverName}</span>
                <span className="text-muted ml-1">({approverType})</span>
              </div>
            </div>
            <Btn size="sm" variant="ghost" onClick={loadAllApprovals}>
              <RefreshCw size={11} className="inline mr-1" /> REFRESH
            </Btn>
          </div>

          {allApprovals.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <ShieldCheck size={48} className="text-green-400" />
              <div className="font-cond font-black text-[18px] text-green-400">
                NO PENDING APPROVALS
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {allApprovals.map((a) => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  applying={approvingId === a.id}
                  approverName={approverName}
                  onApprove={(coachName) => handleApprove(a.id, coachName)}
                  onDeny={() => handleDeny(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Roster list panel ────────────────────────────────────────
function RosterList({
  label,
  players,
  states,
  onToggle,
  onPrintTeam,
}: {
  label: string
  players: PlayerWithExtras[]
  states: Record<number, CheckinState>
  onToggle: (p: PlayerWithExtras) => void
  onPrintTeam: () => void
}) {
  const checked = players.filter((p) => states[p.id]?.status === 'checked').length
  return (
    <div className="bg-surface-card border border-border rounded-lg overflow-hidden">
      <div className="bg-navy/60 px-4 py-2.5 border-b border-border flex justify-between items-center">
        <div className="font-cond font-black text-[14px] text-white">{label}</div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'font-mono text-[18px] font-bold',
              checked === players.length && players.length > 0
                ? 'text-green-400'
                : checked > 0
                  ? 'text-yellow-400'
                  : 'text-muted'
            )}
          >
            {checked}/{players.length}
          </div>
          <button
            onClick={onPrintTeam}
            title="Print team cards"
            className="text-muted hover:text-white transition-colors"
          >
            <Printer size={13} />
          </button>
        </div>
      </div>
      {players.length === 0 ? (
        <div className="p-4 text-center text-muted font-cond text-[12px]">No roster uploaded</div>
      ) : (
        <div className="divide-y divide-border/40">
          {players.map((p) => {
            const s = states[p.id] ?? { status: 'unchecked' }
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  s.status === 'checked'
                    ? 'bg-green-900/15 hover:bg-green-900/20'
                    : s.status === 'pending_approval'
                      ? 'bg-yellow-900/10 hover:bg-yellow-900/15'
                      : s.status === 'blocked_play_down'
                        ? 'bg-red-900/10 cursor-not-allowed'
                        : 'hover:bg-white/5'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center font-cond font-black text-[14px] flex-shrink-0',
                    s.status === 'checked'
                      ? 'bg-green-700 text-white'
                      : s.status === 'pending_approval'
                        ? 'bg-yellow-700/80 text-white'
                        : s.status === 'blocked_play_down'
                          ? 'bg-red-900/50 text-red-400'
                          : 'bg-navy text-muted'
                  )}
                >
                  {p.number ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'font-cond font-bold text-[14px] leading-tight',
                      s.status === 'checked'
                        ? 'text-green-300'
                        : s.status === 'pending_approval'
                          ? 'text-yellow-300'
                          : s.status === 'blocked_play_down'
                            ? 'text-red-400'
                            : 'text-white'
                    )}
                  >
                    {p.name}
                  </div>
                  {s.status === 'pending_approval' && (
                    <div className="font-cond text-[10px] text-yellow-400">⏳ {s.message}</div>
                  )}
                  {s.status === 'blocked_play_down' && (
                    <div className="font-cond text-[10px] text-red-400">⛔ {s.message}</div>
                  )}
                  {p.usa_lacrosse_number && s.status !== 'blocked_play_down' && (
                    <div className="font-mono text-[10px] text-muted">
                      USA #{p.usa_lacrosse_number}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {s.status === 'checked' && <CheckCircle size={18} className="text-green-400" />}
                  {s.status === 'pending_approval' && (
                    <Clock size={18} className="text-yellow-400" />
                  )}
                  {s.status === 'blocked_play_down' && (
                    <XCircle size={18} className="text-red-400" />
                  )}
                  {s.status === 'unchecked' && (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Player Card (cards view) ─────────────────────────────────
function PlayerCard({
  player,
  state,
  baseUrl,
  leagueLogo,
  onToggle,
  onPrint,
}: {
  player: PlayerWithExtras
  state: CheckinState
  baseUrl: string
  leagueLogo: string | null
  onToggle: () => void
  onPrint: () => void
}) {
  const team = player.team as any
  const checkinUrl = player.token ? `${baseUrl}/checkin/${player.token}` : null
  const isChecked = state.status === 'checked'
  const isPending = state.status === 'pending_approval'
  const isBlocked = state.status === 'blocked_play_down'
  const qrUrl = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(checkinUrl)}&color=0B3D91&bgcolor=FFFFFF`
    : null

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all',
        isChecked
          ? 'border-green-700/60 bg-green-900/10'
          : isPending
            ? 'border-yellow-700/50 bg-yellow-900/10'
            : isBlocked
              ? 'border-red-800/50 bg-red-900/10 opacity-75'
              : 'border-border bg-surface-card'
      )}
    >
      {/* Header — navy bar with logo + jersey + name */}
      <div
        className={cn(
          'px-3 py-2.5 border-b border-border/50',
          isChecked ? 'bg-green-900/30' : 'bg-navy'
        )}
      >
        <div className="flex items-center gap-2.5">
          {/* League logo */}
          {leagueLogo ? (
            <img
              src={leagueLogo}
              alt="League"
              className="w-8 h-8 object-contain rounded flex-shrink-0 bg-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-red flex items-center justify-center flex-shrink-0 text-white font-cond font-black text-[11px]">
              LO
            </div>
          )}
          {/* Jersey # */}
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center font-cond font-black text-[15px] flex-shrink-0 border-2',
              isChecked
                ? 'bg-green-700 text-white border-green-500/40'
                : isPending
                  ? 'bg-yellow-700 text-white border-yellow-500/40'
                  : isBlocked
                    ? 'bg-red-900/60 text-red-400 border-red-800/40'
                    : 'bg-red text-white border-red-700/40'
            )}
          >
            {player.number ?? '?'}
          </div>
          {/* Name */}
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'font-cond font-black text-[14px] leading-tight truncate',
                isChecked
                  ? 'text-green-300'
                  : isPending
                    ? 'text-yellow-300'
                    : isBlocked
                      ? 'text-red-400'
                      : 'text-white'
              )}
            >
              {player.name}
            </div>
            <div className="font-cond text-[10px] text-muted truncate">
              {team?.name ?? '—'} · {team?.division ?? '—'}
            </div>
          </div>
          {/* Status icon */}
          {isChecked && <CheckCircle size={16} className="text-green-400 flex-shrink-0" />}
          {isPending && <Clock size={16} className="text-yellow-400 flex-shrink-0" />}
          {isBlocked && <XCircle size={16} className="text-red-400 flex-shrink-0" />}
        </div>
      </div>

      {/* QR code — full width, clickable */}
      <div className="p-2.5">
        {qrUrl ? (
          <a
            href={checkinUrl!}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open check-in for ${player.name}`}
            className="block rounded-lg overflow-hidden border-2 border-border bg-white hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src={qrUrl} alt={`QR for ${player.name}`} className="w-full aspect-square" />
          </a>
        ) : (
          <div className="w-full aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-white/5">
            <div className="font-cond text-[10px] text-muted text-center">
              QR auto-generates when player loads
            </div>
          </div>
        )}
      </div>

      {/* Details row */}
      <div className="px-3 pb-2 space-y-1.5">
        {player.usa_lacrosse_number && (
          <div className="flex justify-between items-center">
            <span className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase">
              USA Lax #
            </span>
            <span className="font-mono text-[13px] font-bold text-white">
              {player.usa_lacrosse_number}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase">
            Jersey
          </span>
          <span className="font-mono text-[14px] font-bold text-white">
            #{player.number ?? '—'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-2.5 pb-2.5 flex gap-1.5">
        <button
          onClick={onToggle}
          className={cn(
            'flex-1 font-cond text-[11px] font-bold py-2 rounded transition-colors',
            isChecked
              ? 'bg-green-700 hover:bg-green-600 text-white'
              : isPending
                ? 'bg-yellow-800/60 text-yellow-300 cursor-wait'
                : isBlocked
                  ? 'bg-red-900/40 text-red-400 cursor-not-allowed'
                  : 'bg-navy hover:bg-navy-light text-white'
          )}
        >
          {isChecked
            ? '✓ CHECKED IN'
            : isPending
              ? '⏳ PENDING'
              : isBlocked
                ? '⛔ BLOCKED'
                : 'CHECK IN'}
        </button>
        <button
          onClick={onPrint}
          className="font-cond text-[11px] px-2 py-2 rounded bg-surface border border-border text-muted hover:text-white transition-colors"
        >
          <Printer size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Approval row (game view) ─────────────────────────────────
function ApprovalRow({
  approval,
  applying,
  approverName,
  onApprove,
  onDeny,
}: {
  approval: PendingApproval
  applying: boolean
  approverName: string
  onApprove: (coachName: string) => void
  onDeny: () => void
}) {
  const [coachName, setCoachName] = useState('')
  const p = approval.player
  return (
    <div className="bg-black/20 border border-yellow-800/30 rounded-lg p-3">
      <div className="font-cond font-bold text-[13px] text-yellow-300 mb-0.5">
        {p?.name ?? `Player #${approval.player_id}`}
        <span className="text-muted font-normal text-[11px] ml-2">
          — needs {approval.opposing_team_name} approval
        </span>
      </div>
      <div className="font-cond text-[10px] text-muted mb-2">
        Approving as: <span className="text-white">{approverName}</span>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-surface border border-border text-white px-2 py-1.5 rounded text-[11px] outline-none focus:border-blue-400"
          placeholder="Coach name who approved (optional)"
          value={coachName}
          onChange={(e) => setCoachName(e.target.value)}
        />
        <button
          onClick={() => onApprove(coachName)}
          disabled={applying}
          className="font-cond text-[11px] font-bold px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
        >
          {applying ? '...' : '✓ APPROVE'}
        </button>
        <button
          onClick={onDeny}
          disabled={applying}
          className="font-cond text-[11px] font-bold px-3 py-1.5 rounded border border-red-800/50 text-red-400 hover:bg-red-900/20 disabled:opacity-50"
        >
          ✗ DENY
        </button>
      </div>
    </div>
  )
}

// ─── Approval card (approvals tab) ───────────────────────────
function ApprovalCard({
  approval,
  applying,
  approverName,
  onApprove,
  onDeny,
}: {
  approval: PendingApproval
  applying: boolean
  approverName: string
  onApprove: (coachName: string) => void
  onDeny: () => void
}) {
  const [coachName, setCoachName] = useState('')
  const p = approval.player
  const team = (p as any)?.team as any
  return (
    <div className="bg-surface-card border border-yellow-800/40 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center font-cond font-black text-[15px] text-yellow-300 flex-shrink-0">
          {p?.number ?? '?'}
        </div>
        <div className="flex-1">
          <div className="font-cond font-black text-[15px] text-white">{p?.name}</div>
          <div className="font-cond text-[11px] text-blue-300">
            {team?.name} · {team?.division}
          </div>
          <div className="font-cond text-[11px] text-muted">
            Game #{approval.first_game_id} → Game #{approval.game_id} · Opposing:{' '}
            <span className="text-white">{approval.opposing_team_name}</span>
          </div>
        </div>
        <div className="font-cond text-[10px] text-muted">
          {new Date(approval.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>
      <div className="font-cond text-[11px] text-muted mb-3">
        Approving as: <span className="text-white font-bold">{approverName}</span>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-surface border border-border text-white px-2.5 py-2 rounded text-[12px] outline-none focus:border-blue-400"
          placeholder="Coach who verbally approved (optional)"
          value={coachName}
          onChange={(e) => setCoachName(e.target.value)}
        />
        <button
          onClick={() => onApprove(coachName)}
          disabled={applying}
          className="font-cond text-[12px] font-bold px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
        >
          {applying ? '...' : '✓ APPROVE & CHECK IN'}
        </button>
        <button
          onClick={onDeny}
          disabled={applying}
          className="font-cond text-[12px] font-bold px-4 py-2 rounded border border-red-800/50 text-red-400 hover:bg-red-900/20 disabled:opacity-50"
        >
          ✗ DENY
        </button>
      </div>
    </div>
  )
}
