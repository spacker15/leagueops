'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  LogOut,
  Upload,
  Plus,
  Trash2,
  Download,
  Users,
  CheckCircle,
  Clock,
  CalendarX,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  FileText,
} from 'lucide-react'
import { ScheduleChangeRequestModal } from '@/components/schedule/ScheduleChangeRequestModal'
import { EventDatePicker, type PickerDate } from '@/components/ui/EventDatePicker'
import { InvoiceModal, type InvoiceData } from '@/components/payments/InvoiceModal'
import type { Game } from '@/types'

// Divisions are derived dynamically from event data (registration_fees + existing teams)

interface Program {
  id: number
  name: string
  short_name: string | null
  city: string | null
  state: string | null
  status: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  association: string | null
  logo_url: string | null
}

interface TeamReg {
  id: number
  team_name: string
  division: string
  head_coach_name: string | null
  head_coach_email: string | null
  player_count: number | null
  status: string
  team_id: number | null
  notes: string | null
}

interface Player {
  id: number
  name: string
  number: number | null
  position: string | null
  team_id: number
}

type Tab = 'overview' | 'teams' | 'rosters' | 'register' | 'matchups'

export function ProgramDashboard({ onSwitchToAdmin }: { onSwitchToAdmin?: () => void } = {}) {
  const { userRole, signOut } = useAuth()
  const isCoach = userRole?.role === 'coach'
  const isAssistantCoach = userRole?.role === 'assistant_coach'
  const isProgramLeader = userRole?.role === 'program_leader'
  const canInviteCoach = isProgramLeader
  const canInviteAssistant = isProgramLeader || isCoach
  const isReadOnly = isAssistantCoach
  const portalEventId = userRole?.event_id
  const [program, setProgram] = useState<Program | null>(null)
  const [teamRegs, setTeamRegs] = useState<TeamReg[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Fee/payment data for the program
  const [programFees, setProgramFees] = useState<any[]>([])
  const [programPayments, setProgramPayments] = useState<any[]>([])
  const [programGameCounts, setProgramGameCounts] = useState<Record<number, number>>({})
  const [showInvoice, setShowInvoice] = useState(false)
  const [eventInfo, setEventInfo] = useState<{
    name: string
    logo_url?: string | null
    location?: string | null
    start_date?: string | null
    end_date?: string | null
  } | null>(null)
  const [availableDivisions, setAvailableDivisions] = useState<string[]>([])

  // Matchup data — all teams + games in same divisions as this program's teams
  const [matchupDivTeams, setMatchupDivTeams] = useState<
    { id: number; name: string; division: string }[]
  >([])
  const [matchupDivGames, setMatchupDivGames] = useState<
    { id: number; home_team_id: number; away_team_id: number; division: string }[]
  >([])

  // New team form
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDiv, setNewTeamDiv] = useState('')
  const [newCoachName, setNewCoachName] = useState('')
  const [newCoachEmail, setNewCoachEmail] = useState('')
  const [newPlayerCount, setNewPlayerCount] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)

  // Schedule change request state
  const [programGames, setProgramGames] = useState<Game[]>([])
  const [pendingGameIds, setPendingGameIds] = useState<Set<number>>(new Set())
  const [gameScrStatus, setGameScrStatus] = useState<Map<number, string>>(new Map())
  const [scrModalOpen, setScrModalOpen] = useState(false)
  const [scrPreSelectedGameId, setScrPreSelectedGameId] = useState<number | undefined>()
  const [scrTeamId, setScrTeamId] = useState<number | undefined>()

  // Weather alerts
  const [weatherAlerts, setWeatherAlerts] = useState<
    { id: number; alert_type: string; description: string; complex?: { name: string } | null }[]
  >([])

  // Teams tab UI state
  const [collapsedDivisions, setCollapsedDivisions] = useState<Set<string>>(new Set())
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null)

  // Program leaders + coaches for overview card
  const [programUsers, setProgramUsers] = useState<{ display_name: string; role: string }[]>([])

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'coach' | 'assistant_coach'>('coach')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)

  useEffect(() => {
    loadData()
  }, [userRole])

  if (!portalEventId) return null

  async function loadData() {
    if (!userRole?.program_id) {
      setLoading(false)
      return
    }
    const sb = createClient()
    setLoading(true)

    try {
      const [{ data: prog }, { data: regs }, { data: teamData }] = await Promise.all([
        sb.from('programs').select('*').eq('id', userRole.program_id).single(),
        sb
          .from('team_registrations')
          .select('*')
          .eq('program_id', userRole.program_id)
          .order('created_at'),
        sb
          .from('program_teams')
          .select('*, team:teams(id, name, division, logo_url)')
          .eq('program_id', userRole.program_id),
      ])

      setProgram(prog as Program)
      setTeamRegs((regs as TeamReg[]) ?? [])
      const teamsList = (teamData ?? []).map((pt: any) => pt.team).filter(Boolean)
      setTeams(teamsList)

      // Load games and pending schedule change requests for Request Change buttons
      if (teamsList.length > 0) {
        const teamIds = teamsList.map((t: any) => t.id)
        const { data: gamesData } = await sb
          .from('games')
          .select(
            '*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name), field:fields(id, name), event_date:event_dates(id, date, label)'
          )
          .eq('event_id', portalEventId!)
          .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
          .order('event_date_id')
          .order('scheduled_time')
        setProgramGames((gamesData as Game[]) ?? [])

        const { data: scrData } = await sb
          .from('schedule_change_requests')
          .select('id, status, schedule_change_request_games(game_id, status)')
          .eq('event_id', portalEventId!)
          .in('team_id', teamIds)
        const pendingIds = new Set<number>()
        const gameRequestStatus = new Map<number, string>()
        for (const r of (scrData ?? []) as any[]) {
          for (const g of r.schedule_change_request_games ?? []) {
            if (['pending', 'under_review'].includes(r.status)) {
              pendingIds.add(g.game_id)
            }
            // Track the most recent game-level status
            gameRequestStatus.set(g.game_id, g.status)
          }
        }
        setPendingGameIds(pendingIds)
        setGameScrStatus(gameRequestStatus)

        // Count games per team
        const counts: Record<number, number> = {}
        for (const g of (gamesData ?? []) as any[]) {
          if (g.home_team_id) counts[g.home_team_id] = (counts[g.home_team_id] || 0) + 1
          if (g.away_team_id) counts[g.away_team_id] = (counts[g.away_team_id] || 0) + 1
        }
        setProgramGameCounts(counts)

        // Load all teams + games in the same divisions for the matchup matrix
        const divs = [...new Set(teamsList.map((t: any) => t.division as string).filter(Boolean))]
        if (divs.length > 0) {
          const [{ data: divTeamsData }, { data: divGamesData }] = await Promise.all([
            sb
              .from('teams')
              .select('id, name, division')
              .eq('event_id', portalEventId!)
              .in('division', divs)
              .order('name'),
            sb
              .from('games')
              .select('id, home_team_id, away_team_id, division')
              .eq('event_id', portalEventId!)
              .in('division', divs)
              .neq('status', 'Cancelled'),
          ])
          setMatchupDivTeams(
            (divTeamsData ?? []) as { id: number; name: string; division: string }[]
          )
          setMatchupDivGames(
            (divGamesData ?? []) as {
              id: number
              home_team_id: number
              away_team_id: number
              division: string
            }[]
          )
        }
      }

      // Load program leaders + coaches and weather alerts in parallel
      const [{ data: usersData }, { data: alertsData }] = await Promise.all([
        sb
          .from('user_roles')
          .select('display_name, role')
          .eq('program_id', userRole.program_id)
          .in('role', ['program_leader', 'coach'])
          .eq('is_active', true),
        sb
          .from('weather_alerts')
          .select('id, alert_type, description, complex:complexes(name)')
          .eq('event_id', portalEventId!)
          .eq('is_active', true),
      ])
      setProgramUsers((usersData as { display_name: string; role: string }[]) ?? [])
      setWeatherAlerts((alertsData as any[]) ?? [])

      // Load fees, payment records, and event info
      const [{ data: feesData }, { data: paymentsData }, { data: eventData }] = await Promise.all([
        sb.from('registration_fees').select('*').eq('event_id', portalEventId!),
        sb
          .from('team_payments')
          .select('*')
          .eq('event_id', portalEventId!)
          .eq('program_name', prog?.name || ''),
        sb
          .from('events')
          .select('id, name, location, start_date, end_date, logo_url')
          .eq('id', portalEventId!)
          .single(),
      ])
      setProgramFees(feesData ?? [])
      setProgramPayments(paymentsData ?? [])
      if (eventData) {
        setEventInfo({
          name: eventData.name,
          logo_url: (eventData as any).logo_url ?? null,
          location: eventData.location ?? null,
          start_date: eventData.start_date ?? null,
          end_date: eventData.end_date ?? null,
        })
      }
      // Derive available divisions from fee config + existing team registrations
      const feeDivs = (feesData ?? []).map((f: any) => f.division as string)
      const regDivs = ((regs as TeamReg[]) ?? []).map((r) => r.division)
      const teamDivs = teamsList.map((t: any) => t.division as string)
      const allDivs = Array.from(
        new Set([...feeDivs, ...regDivs, ...teamDivs].filter(Boolean))
      ).sort()
      setAvailableDivisions(allDivs)
    } catch (err) {
      console.error('ProgramDashboard loadData error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlayers(teamId: number) {
    const sb = createClient()
    const { data } = await sb.from('players').select('*').eq('team_id', teamId).order('name')
    setPlayers((data as Player[]) ?? [])
    setSelectedTeam(teamId)
  }

  async function submitNewTeam() {
    if (!newTeamName) {
      toast.error('Team name required')
      return
    }
    if (!userRole?.program_id) return
    setAddingTeam(true)
    const sb = createClient()
    const { data: reg, error } = await sb
      .from('team_registrations')
      .insert({
        program_id: userRole.program_id,
        event_id: portalEventId,
        team_name: newTeamName,
        division: newTeamDiv,
        head_coach_name: newCoachName || null,
        head_coach_email: newCoachEmail || null,
        player_count: newPlayerCount ? Number(newPlayerCount) : null,
        status: 'approved',
      })
      .select()
      .single()
    if (error) {
      toast.error(error.message)
      setAddingTeam(false)
      return
    }
    // Auto-create team record
    if (reg) {
      const { data: newTeam } = await sb
        .from('teams')
        .insert({
          event_id: portalEventId,
          name: newTeamName,
          division: newTeamDiv,
          program_id: userRole.program_id || null,
        })
        .select()
        .single()
      if (newTeam && userRole.program_id) {
        await sb.from('program_teams').insert({
          program_id: userRole.program_id,
          team_id: (newTeam as any).id,
          event_id: portalEventId,
          division: newTeamDiv,
        })
      }
    }
    toast.success('Team registered and approved!')
    setNewTeamName('')
    setNewCoachName('')
    setNewCoachEmail('')
    setNewPlayerCount('')
    await loadData()
    setAddingTeam(false)
  }

  async function uploadRoster(file: File, teamId: number) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const lines = text.trim().split('\n')
      const hasHeader =
        lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('first')
      const dataLines = hasHeader ? lines.slice(1) : lines

      const sb = createClient()
      let count = 0
      for (const line of dataLines) {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        if (!cols[1] && !cols[0]) continue

        // Support NFYLL format (10 cols) or simple (Name, Number, Position)
        const name = cols.length >= 10 ? `${cols[1]} ${cols[2]}`.trim() : cols[0]
        const num = cols.length >= 10 ? null : cols[1] ? Number(cols[1]) : null
        const pos = cols.length >= 10 ? (cols[9] === 'Coach' ? 'Coach' : null) : cols[2] || null

        if (!name) continue
        await sb
          .from('players')
          .upsert(
            { team_id: teamId, name, number: num, position: pos },
            { onConflict: 'team_id,name' }
          )
        count++
      }
      toast.success(`${count} players imported`)
      if (selectedTeam === teamId) loadPlayers(teamId)
    }
    reader.readAsText(file)
  }

  async function deletePlayer(id: number) {
    const sb = createClient()
    await sb.from('players').delete().eq('id', id)
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    toast.success('Player removed')
  }

  function exportRoster(teamId: number) {
    const team = teams.find((t) => t.id === teamId)
    const teamPlayers = players.filter((p) => p.team_id === teamId)
    const header =
      'USA Lacrosse Number,Firstname,Lastname,Birthdate,Zipcode,Email,Div,Team,association,Player or Coach'
    const rows = teamPlayers.map((p) => {
      const [first, ...rest] = p.name.split(' ')
      return `,,${first},${rest.join(' ')},,,,${team?.division ?? ''},${team?.name ?? ''},${program?.name ?? ''},${p.position === 'Coach' ? 'Coach' : 'Player'}`
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${team?.name ?? 'roster'}_roster.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Roster exported')
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !userRole?.program_id) return
    setInviting(true)
    const sb = createClient()
    const { data, error } = await sb
      .from('program_invites')
      .insert({
        program_id: userRole.program_id,
        event_id: portalEventId,
        invited_email: inviteEmail.trim().toLowerCase(),
        invited_role: inviteRole,
        invited_by: null, // client-side insert; service role not needed
      })
      .select('token')
      .single()
    setInviting(false)
    if (error || !data) {
      toast.error(error?.message ?? 'Failed to create invite')
      return
    }
    const link = `${window.location.origin}/join/coach/${data.token}`
    setInviteLink(link)
    setInviteEmail('')
    toast.success('Invite link generated!')
  }

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  if (loading)
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )

  const isPending = program?.status === 'pending'
  const isApproved = program?.status === 'approved'
  const approvedTeams = teamRegs.filter((t) => t.status === 'approved')
  const pendingTeams = teamRegs.filter((t) => t.status === 'pending')

  return (
    <div className="min-h-screen bg-surface overflow-y-auto">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-4 py-0 flex items-stretch">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="w-7 h-7 bg-red rounded flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.4" />
            </svg>
          </div>
          <span className="font-cond text-lg font-black tracking-widest text-white">LEAGUEOPS</span>
          <span className="font-cond text-[11px] text-muted tracking-widest border-l border-border pl-3">
            PROGRAM PORTAL
          </span>
        </div>

        {/* Nav tabs */}
        <nav className="flex flex-1 ml-4">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'teams', label: `Teams (${teamRegs.length})` },
              { id: 'rosters', label: 'Rosters' },
              { id: 'matchups', label: 'Matchups' },
              ...(!isCoach && !isAssistantCoach
                ? [{ id: 'register', label: '+ Register Team' }]
                : []),
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 font-cond text-[12px] font-bold tracking-widest uppercase border-b-2 transition-colors',
                tab === t.id
                  ? 'border-red text-white'
                  : 'border-transparent text-muted hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 px-4">
          {isAssistantCoach && (
            <span className="font-cond text-[9px] font-black tracking-widest text-muted border border-border rounded px-2 py-0.5 uppercase">
              View Only
            </span>
          )}
          {onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className="font-cond text-[11px] font-bold text-blue-300 hover:text-white border border-border rounded px-3 py-1.5 transition-colors"
            >
              ADMIN VIEW
            </button>
          )}
          <span className="font-cond text-[11px] text-white">{userRole?.display_name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 font-cond text-[11px] text-muted hover:text-white transition-colors"
          >
            <LogOut size={13} /> SIGN OUT
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Weather alerts banner */}
        {weatherAlerts.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {weatherAlerts
              .filter(
                (alert, idx, arr) => arr.findIndex((a) => a.alert_type === alert.alert_type) === idx
              )
              .map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg px-3 py-2"
                >
                  <span className="text-yellow-400 text-[14px]">⚡</span>
                  <div>
                    <span className="font-cond text-[10px] font-black tracking-widest text-yellow-300 uppercase mr-2">
                      {alert.alert_type}
                    </span>
                    <span className="font-cond text-[11px] text-yellow-200">
                      {alert.description}
                    </span>
                    {alert.complex?.name && (
                      <span className="font-cond text-[10px] text-yellow-400/70 ml-2">
                        — {alert.complex.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Pending approval banner */}
        {isPending && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Clock size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-cond font-black text-[14px] text-yellow-400 mb-1">
                PENDING REVIEW
              </div>
              <div className="font-cond text-[12px] text-muted leading-relaxed">
                Your program registration is being reviewed by the league administrator. You'll
                receive access to manage teams and rosters once approved. Team registrations
                submitted are also under review.
              </div>
            </div>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {/* Program card */}
              <div className="col-span-2 bg-surface-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {program?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={program.logo_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : null}
                    <div>
                      <div className="font-cond font-black text-[22px] text-white">
                        {program?.name}
                      </div>
                      {program?.short_name && (
                        <div className="font-cond text-[12px] text-blue-300">
                          {program.short_name}
                        </div>
                      )}
                      <div className="font-cond text-[12px] text-muted mt-1">
                        {[program?.city, program?.state, program?.association]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'font-cond text-[11px] font-black px-3 py-1 rounded tracking-wider',
                      program?.status === 'approved'
                        ? 'bg-green-900/40 text-green-400 border border-green-800/50'
                        : program?.status === 'pending'
                          ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'
                          : program?.status === 'rejected'
                            ? 'bg-red-900/40 text-red-400 border border-red-800/50'
                            : 'bg-surface text-muted border border-border'
                    )}
                  >
                    {program?.status?.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-4 text-[12px]">
                  {/* Program Leaders */}
                  {(() => {
                    const leaders = programUsers.filter((u) => u.role === 'program_leader')
                    const coaches = programUsers.filter((u) => u.role === 'coach')
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="font-cond text-[10px] text-muted uppercase tracking-widest mb-1.5">
                            Program Leaders
                          </div>
                          {leaders.length > 0 ? (
                            <div className="space-y-1">
                              {leaders.map((u, i) => (
                                <div key={i} className="font-cond font-bold text-white text-[12px]">
                                  {u.display_name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="font-cond text-muted text-[11px]">
                              {program?.contact_name}
                            </div>
                          )}
                          <div className="mt-1 space-y-0.5">
                            {program?.contact_email && (
                              <div className="flex items-center gap-1 text-muted font-cond text-[11px]">
                                <Mail size={10} className="flex-shrink-0" />
                                {program.contact_email}
                              </div>
                            )}
                            {program?.contact_phone && (
                              <div className="flex items-center gap-1 text-muted font-cond text-[11px]">
                                <Phone size={10} className="flex-shrink-0" />
                                {program.contact_phone}
                              </div>
                            )}
                          </div>
                        </div>
                        {coaches.length > 0 && (
                          <div>
                            <div className="font-cond text-[10px] text-muted uppercase tracking-widest mb-1.5">
                              Coaches
                            </div>
                            <div className="space-y-1">
                              {coaches.map((u, i) => (
                                <div key={i} className="font-cond font-bold text-white text-[12px]">
                                  {u.display_name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {/* Invite section — visible to program leaders and coaches */}
                  {(canInviteCoach || canInviteAssistant) && (
                    <div className="border-t border-border/40 pt-3">
                      <div className="font-cond text-[10px] text-muted uppercase tracking-widest mb-2">
                        Invite Staff
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          className="flex-1 bg-surface border border-border text-white px-3 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400 placeholder-muted"
                          placeholder="coach@email.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        {canInviteCoach && (
                          <select
                            className="bg-[#040e24] border border-border text-white px-2 py-1.5 rounded-lg text-[11px] outline-none"
                            value={inviteRole}
                            onChange={(e) =>
                              setInviteRole(e.target.value as 'coach' | 'assistant_coach')
                            }
                          >
                            <option value="coach">Coach</option>
                            <option value="assistant_coach">Asst. Coach</option>
                          </select>
                        )}
                        <button
                          onClick={sendInvite}
                          disabled={inviting || !inviteEmail.trim()}
                          className="font-cond text-[11px] font-bold bg-navy border border-border text-white px-3 py-1.5 rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {inviting ? '...' : 'INVITE'}
                        </button>
                      </div>
                      {inviteLink && (
                        <div className="mt-2 flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                          <span className="font-mono text-[10px] text-blue-300 truncate flex-1">
                            {inviteLink}
                          </span>
                          <button
                            onClick={copyInviteLink}
                            className="font-cond text-[10px] font-bold text-muted hover:text-white transition-colors whitespace-nowrap"
                          >
                            {inviteCopied ? '✓ COPIED' : 'COPY'}
                          </button>
                        </div>
                      )}
                      <div className="font-cond text-[9px] text-muted mt-1">
                        Share the link with the invitee — they&apos;ll create their account from it.
                      </div>
                    </div>
                  )}

                  {/* Upcoming games */}
                  {(() => {
                    const today = new Date().toISOString().split('T')[0]
                    const upcoming = programGames
                      .filter(
                        (g) =>
                          (g.event_date as any)?.date &&
                          (g.event_date as any).date >= today &&
                          g.status !== 'Cancelled' &&
                          g.status !== 'Final'
                      )
                      .slice(0, 5)
                    if (upcoming.length === 0) return null
                    return (
                      <div>
                        <div className="font-cond text-[10px] text-muted uppercase tracking-widest mb-1.5">
                          Upcoming Games
                        </div>
                        <div className="space-y-1">
                          {upcoming.map((game) => {
                            const isHome = teams.some((t: any) => t.id === game.home_team_id)
                            const myTeam = isHome
                              ? (game.home_team as any)?.name
                              : (game.away_team as any)?.name
                            const opponent = isHome
                              ? (game.away_team as any)?.name
                              : (game.home_team as any)?.name
                            const dateStr = (game.event_date as any)?.date
                              ? new Date(
                                  (game.event_date as any).date + 'T00:00:00'
                                ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : ''
                            return (
                              <div
                                key={game.id}
                                className="flex items-center gap-2 text-[11px] bg-surface rounded px-2 py-1.5"
                              >
                                <span className="font-mono text-muted whitespace-nowrap">
                                  {dateStr} {game.scheduled_time}
                                </span>
                                <span className="font-cond text-white font-bold truncate">
                                  {myTeam ?? '—'} vs {opponent ?? '—'}
                                </span>
                                <span className="font-cond text-[9px] text-muted ml-auto whitespace-nowrap">
                                  {(game.field as any)?.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                {[
                  { label: 'TEAMS REGISTERED', value: teamRegs.length, color: 'text-blue-300' },
                  { label: 'APPROVED TEAMS', value: approvedTeams.length, color: 'text-green-400' },
                  { label: 'PENDING REVIEW', value: pendingTeams.length, color: 'text-yellow-400' },
                  { label: 'TOTAL PLAYERS', value: players.length, color: 'text-white' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-surface-card border border-border rounded-xl p-4"
                  >
                    <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-1">
                      {s.label}
                    </div>
                    <div className={cn('font-mono text-3xl font-bold', s.color)}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fees Summary */}
            {programPayments.length > 0 && (
              <div className="bg-surface-card border border-border rounded-xl overflow-hidden mt-5">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <DollarSign size={13} className="text-muted" />
                  <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase flex-1">
                    Fees & Payments
                  </span>
                  <button
                    onClick={() => setShowInvoice(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-cond font-bold text-[#5a6e9a] hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <FileText size={11} />
                    Invoice
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        'Team',
                        'Division',
                        'Reg Fee',
                        'Games',
                        'Extra',
                        'Extra Fee',
                        'Total Due',
                        'Paid',
                        'Balance',
                      ].map((h) => (
                        <th
                          key={h}
                          className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-3 py-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {programPayments.map((p: any) => {
                      const gamesPlayed = p.team_id ? programGameCounts[p.team_id] || 0 : 0
                      const feeConfig = programFees.find((f: any) => f.division === p.division)
                      const gamesIncluded = feeConfig ? Number(feeConfig.games_included) || 0 : 0
                      const extraGames =
                        gamesIncluded > 0 ? Math.max(0, gamesPlayed - gamesIncluded) : 0
                      const perGame = feeConfig
                        ? (Number(feeConfig.extra_game_ref_fee) || 0) +
                          (Number(feeConfig.extra_game_assigner_fee) || 0)
                        : 0
                      const extraFee = extraGames * perGame
                      const totalDue = Number(p.amount_due) + extraFee
                      const balance = totalDue - Number(p.amount_paid)
                      return (
                        <tr key={p.id} className="border-b border-[#0d1a2e] last:border-0">
                          <td className="px-3 py-2.5 font-cond font-bold text-[12px] text-white">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const t = teams.find((tm: any) => tm.id === p.team_id)
                                const logoSrc = t?.logo_url || program?.logo_url || null
                                return logoSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={logoSrc}
                                    alt=""
                                    className="w-5 h-5 rounded object-cover flex-shrink-0"
                                  />
                                ) : null
                              })()}
                              {p.team_name}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-cond text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1a2d50] text-blue-300">
                              {p.division}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[12px] text-white">
                            ${Number(p.amount_due).toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-muted">
                            {gamesPlayed}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-orange-400">
                            {extraGames > 0 ? `+${extraGames}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[12px] text-orange-400">
                            {extraFee > 0 ? `$${extraFee.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[12px] font-bold text-white">
                            ${totalDue.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[12px] text-green-400">
                            ${Number(p.amount_paid).toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 font-cond text-[12px] font-bold',
                              balance > 0 ? 'text-yellow-400' : 'text-green-400'
                            )}
                          >
                            ${balance.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                    {(() => {
                      const totRegFee = programPayments.reduce(
                        (s: number, p: any) => s + Number(p.amount_due),
                        0
                      )
                      const totExtraFee = programPayments.reduce((s: number, p: any) => {
                        const gp = p.team_id ? programGameCounts[p.team_id] || 0 : 0
                        const fc = programFees.find((f: any) => f.division === p.division)
                        const gi = fc ? Number(fc.games_included) || 0 : 0
                        const eg = gi > 0 ? Math.max(0, gp - gi) : 0
                        const pg = fc
                          ? (Number(fc.extra_game_ref_fee) || 0) +
                            (Number(fc.extra_game_assigner_fee) || 0)
                          : 0
                        return s + eg * pg
                      }, 0)
                      const totPaid = programPayments.reduce(
                        (s: number, p: any) => s + Number(p.amount_paid),
                        0
                      )
                      const grandTotal = totRegFee + totExtraFee
                      return (
                        <tr className="bg-[#040d1c]">
                          <td
                            colSpan={2}
                            className="px-3 py-2.5 font-cond text-[11px] font-black tracking-wider text-muted uppercase text-right"
                          >
                            Totals
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[12px] font-bold text-white">
                            ${totRegFee.toFixed(2)}
                          </td>
                          <td colSpan={2} />
                          <td className="px-3 py-2.5 font-cond text-[12px] font-bold text-orange-400">
                            {totExtraFee > 0 ? `$${totExtraFee.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[14px] font-black text-white">
                            ${grandTotal.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 font-cond text-[12px] font-bold text-green-400">
                            ${totPaid.toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 font-cond text-[14px] font-black',
                              grandTotal - totPaid > 0 ? 'text-yellow-400' : 'text-green-400'
                            )}
                          >
                            ${(grandTotal - totPaid).toFixed(2)}
                          </td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── TEAMS ── */}
        {tab === 'teams' && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            {/* Date filter bar */}
            {(() => {
              const seen = new Set<number>()
              const pickerDates: PickerDate[] = []
              for (const g of programGames) {
                const ed = g.event_date as any
                if (ed?.id && !seen.has(ed.id)) {
                  seen.add(ed.id)
                  pickerDates.push({ id: ed.id, date: ed.date, label: ed.label ?? null })
                }
              }
              pickerDates.sort((a, b) => a.date.localeCompare(b.date))
              if (pickerDates.length === 0) return null
              return (
                <EventDatePicker
                  dates={pickerDates}
                  selectedId={selectedDateId}
                  onChange={setSelectedDateId}
                  className="mb-4"
                />
              )
            })()}
            {teamRegs.length === 0 ? (
              <div className="text-center py-16 text-muted font-cond">
                No teams registered yet. Click "+ Register Team" to add one.
              </div>
            ) : (
              (() => {
                const divisions = [...new Set(teamRegs.map((r) => r.division))].sort()
                return divisions.map((div) => {
                  const isCollapsed = collapsedDivisions.has(div)
                  return (
                    <div key={div} className="mb-6">
                      <button
                        onClick={() =>
                          setCollapsedDivisions((prev) => {
                            const next = new Set(prev)
                            if (next.has(div)) next.delete(div)
                            else next.add(div)
                            return next
                          })
                        }
                        className="flex items-center gap-2 mb-3 sticky top-0 bg-surface py-2 z-10 w-full text-left hover:opacity-80 transition-opacity"
                      >
                        {isCollapsed ? (
                          <ChevronRight size={16} className="text-muted flex-shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="text-muted flex-shrink-0" />
                        )}
                        <div className="w-1 h-5 rounded-sm bg-navy flex-shrink-0" />
                        <span className="font-cond text-[14px] font-black tracking-[.12em] text-blue-300 uppercase">
                          {div}
                        </span>
                        <span className="font-cond text-[9px] text-muted">
                          {teamRegs.filter((r) => r.division === div).length} team
                          {teamRegs.filter((r) => r.division === div).length !== 1 ? 's' : ''}
                        </span>
                      </button>
                      {isCollapsed ? null : (
                        <div className="space-y-3">
                          {teamRegs
                            .filter((r) => r.division === div)
                            .map((reg) => (
                              <div
                                key={reg.id}
                                className={cn(
                                  'bg-surface-card border rounded-xl p-4',
                                  reg.status === 'approved'
                                    ? 'border-green-700/50'
                                    : reg.status === 'rejected'
                                      ? 'border-red-700/50'
                                      : 'border-border'
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    {(() => {
                                      const matchedTeam = teams.find(
                                        (t: any) =>
                                          t.name.toLowerCase() === reg.team_name.toLowerCase()
                                      )
                                      const logoSrc =
                                        matchedTeam?.logo_url || program?.logo_url || null
                                      return logoSrc ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={logoSrc}
                                          alt=""
                                          className="w-9 h-9 rounded object-cover flex-shrink-0 mt-0.5"
                                        />
                                      ) : null
                                    })()}
                                    <div>
                                      <div className="font-cond font-black text-[16px] text-white">
                                        {reg.team_name}
                                      </div>
                                      <div className="font-cond text-[12px] text-blue-300 mb-2">
                                        {reg.division}
                                      </div>
                                      {reg.head_coach_name && (
                                        <div className="font-cond text-[11px] text-muted">
                                          Coach: {reg.head_coach_name}
                                          {reg.head_coach_email && ` · ${reg.head_coach_email}`}
                                        </div>
                                      )}
                                      {reg.player_count && (
                                        <div className="font-cond text-[11px] text-muted">
                                          {reg.player_count} players expected
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {reg.status === 'approved' && reg.team_id && (
                                      <button
                                        onClick={() => {
                                          setTab('rosters')
                                          loadPlayers(reg.team_id!)
                                        }}
                                        className="font-cond text-[11px] font-bold text-blue-300 bg-navy/40 border border-border rounded px-3 py-1.5 hover:bg-navy transition-colors"
                                      >
                                        MANAGE ROSTER
                                      </button>
                                    )}
                                    <span
                                      className={cn(
                                        'font-cond text-[10px] font-black px-2.5 py-1 rounded tracking-wider',
                                        reg.status === 'approved'
                                          ? 'bg-green-900/40 text-green-400'
                                          : reg.status === 'rejected'
                                            ? 'bg-red-900/40 text-red-400'
                                            : reg.status === 'waitlist'
                                              ? 'bg-orange-900/40 text-orange-400'
                                              : 'bg-yellow-900/30 text-yellow-400'
                                      )}
                                    >
                                      {reg.status.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                {reg.status === 'rejected' && reg.notes && (
                                  <div className="mt-2 text-[11px] text-red-300 font-cond bg-red-900/10 rounded px-3 py-2">
                                    Note: {reg.notes}
                                  </div>
                                )}
                                {/* Games with Request Change buttons */}
                                {(() => {
                                  const matchedTeam = teams.find(
                                    (t: any) => t.name.toLowerCase() === reg.team_name.toLowerCase()
                                  )
                                  if (!matchedTeam) return null
                                  const allTeamGames = programGames.filter(
                                    (g) =>
                                      g.home_team_id === matchedTeam.id ||
                                      g.away_team_id === matchedTeam.id
                                  )
                                  const teamGames =
                                    selectedDateId !== null
                                      ? allTeamGames.filter(
                                          (g) => (g.event_date as any)?.id === selectedDateId
                                        )
                                      : allTeamGames
                                  if (teamGames.length === 0) return null
                                  return (
                                    <div className="mt-3 pt-3 border-t border-border/40">
                                      <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-2">
                                        UPCOMING GAMES
                                      </div>
                                      <div className="space-y-1.5">
                                        {teamGames.map((game) => {
                                          const isPending = pendingGameIds.has(game.id)
                                          const isCancelled = game.status === 'Cancelled'
                                          const scrStatus = gameScrStatus.get(game.id)
                                          const today = new Date().toISOString().split('T')[0]
                                          const isPastGame =
                                            !!(game.event_date as any)?.date &&
                                            (game.event_date as any).date < today
                                          const opponent =
                                            game.home_team_id === matchedTeam.id
                                              ? ((game.away_team as any)?.name ??
                                                `Team #${game.away_team_id}`)
                                              : ((game.home_team as any)?.name ??
                                                `Team #${game.home_team_id}`)
                                          return (
                                            <div
                                              key={game.id}
                                              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 bg-surface border border-border/40 ${isCancelled ? 'opacity-50' : ''}`}
                                            >
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span
                                                  className={`font-mono text-[11px] text-muted whitespace-nowrap ${isCancelled ? 'line-through' : ''}`}
                                                >
                                                  {(game.event_date as any)?.date
                                                    ? new Date(
                                                        (game.event_date as any).date + 'T00:00:00'
                                                      ).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                      })
                                                    : ''}{' '}
                                                  {game.scheduled_time}
                                                </span>
                                                <span className="font-cond text-[12px] text-white font-black truncate">
                                                  vs {opponent}
                                                </span>
                                              </div>
                                              {isPending && (
                                                <span className="badge-request-pending font-cond text-[9px] font-black tracking-wider px-2 py-0.5 rounded">
                                                  REQUEST PENDING
                                                </span>
                                              )}
                                              {!isPending && scrStatus === 'rescheduled' && (
                                                <span className="badge-request-approved font-cond text-[9px] font-black tracking-wider px-2 py-0.5 rounded">
                                                  RESCHEDULED
                                                </span>
                                              )}
                                              {!isPending && scrStatus === 'denied' && (
                                                <span className="badge-request-denied font-cond text-[9px] font-black tracking-wider px-2 py-0.5 rounded">
                                                  DENIED
                                                </span>
                                              )}
                                              {!isPending && scrStatus === 'cancelled' && (
                                                <span className="badge-request-approved font-cond text-[9px] font-black tracking-wider px-2 py-0.5 rounded">
                                                  CANCELLED
                                                </span>
                                              )}
                                              {!isCancelled && !isPending && !isPastGame && (
                                                <button
                                                  onClick={() => {
                                                    setScrTeamId(matchedTeam.id)
                                                    setScrPreSelectedGameId(game.id)
                                                    setScrModalOpen(true)
                                                  }}
                                                  className="flex items-center gap-1 font-cond text-[10px] font-bold tracking-wider text-muted hover:text-white border border-border rounded px-2 py-1 transition-colors"
                                                >
                                                  <CalendarX size={11} />
                                                  REQUEST CHANGE
                                                </button>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                })
              })()
            )}
          </div>
        )}

        {/* ── ROSTERS ── */}
        {tab === 'rosters' && (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap">
              {approvedTeams
                .filter((t) => t.team_id)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => loadPlayers(t.team_id!)}
                    className={cn(
                      'font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
                      selectedTeam === t.team_id
                        ? 'bg-navy border-blue-400 text-white'
                        : 'bg-surface-card border-border text-muted hover:text-white hover:border-blue-400'
                    )}
                  >
                    {t.team_name} <span className="text-blue-300 ml-1">{t.division}</span>
                  </button>
                ))}
              {approvedTeams.length === 0 && (
                <div className="text-muted font-cond text-[13px]">
                  No approved teams yet. Rosters become available once teams are approved.
                </div>
              )}
            </div>

            {selectedTeam && (
              <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-navy/60 border-b border-border flex justify-between items-center">
                  <div className="font-cond font-black text-[13px] tracking-wide">
                    {teams.find((t) => t.id === selectedTeam)?.name} — {players.length} players
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 font-cond text-[11px] font-bold bg-navy border border-border text-white px-3 py-1.5 rounded hover:bg-navy-light transition-colors"
                    >
                      <Upload size={11} /> UPLOAD CSV
                    </button>
                    <button
                      onClick={() => exportRoster(selectedTeam)}
                      className="flex items-center gap-1.5 font-cond text-[11px] font-bold bg-navy border border-border text-blue-300 px-3 py-1.5 rounded hover:bg-navy-light transition-colors"
                    >
                      <Download size={11} /> EXPORT
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadRoster(f, selectedTeam)
                      }}
                    />
                  </div>
                </div>

                {players.length === 0 ? (
                  <div className="text-center py-12">
                    <Users size={32} className="mx-auto text-muted mb-3" />
                    <div className="font-cond text-muted text-[13px] mb-2">
                      No players added yet
                    </div>
                    <div className="font-cond text-[11px] text-muted">
                      Upload a CSV roster to get started
                    </div>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-navy/60">
                        {['#', 'NAME', 'POSITION', 'TYPE', ''].map((h) => (
                          <th
                            key={h}
                            className="font-cond text-[10px] font-black tracking-widest text-muted px-4 py-2 text-left"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {players
                        .filter((p) => p.position === 'Coach')
                        .map((p) => (
                          <tr key={p.id} className="border-b border-border/40 bg-yellow-900/8">
                            <td className="px-4 py-2 text-muted">—</td>
                            <td className="px-4 py-2 font-cond font-bold text-yellow-300">
                              {p.name}
                            </td>
                            <td className="px-4 py-2 text-muted">—</td>
                            <td className="px-4 py-2">
                              <span className="font-cond text-[9px] font-bold bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded">
                                COACH
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => deletePlayer(p.id)}
                                className="text-muted hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {players
                        .filter((p) => p.position !== 'Coach')
                        .map((p, i) => (
                          <tr
                            key={p.id}
                            className={`border-b border-border/40 ${i % 2 === 0 ? '' : 'bg-white/5'}`}
                          >
                            <td className="font-mono text-muted px-4 py-2">{p.number ?? '—'}</td>
                            <td className="font-cond font-bold text-white px-4 py-2">{p.name}</td>
                            <td className="text-muted px-4 py-2">{p.position ?? '—'}</td>
                            <td className="px-4 py-2">
                              <span className="font-cond text-[9px] font-bold bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
                                PLAYER
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => deletePlayer(p.id)}
                                className="text-muted hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REGISTER TEAM ── */}
        {tab === 'register' && (
          <div className="max-w-xl">
            <div className="bg-surface-card border border-border rounded-xl p-6">
              <div className="font-cond font-black text-[15px] tracking-wide mb-5">
                REGISTER ANOTHER TEAM
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                    Team Name *
                  </label>
                  <input
                    className="w-full bg-surface border border-border text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder={`${program?.short_name ?? 'Program'} Team Name`}
                  />
                </div>
                <div>
                  <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                    Division *
                  </label>
                  <select
                    className="w-full bg-surface border border-border text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400"
                    value={newTeamDiv}
                    onChange={(e) => setNewTeamDiv(e.target.value)}
                  >
                    <option value="">— Select Division —</option>
                    {availableDivisions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                      Head Coach Name
                    </label>
                    <input
                      className="w-full bg-surface border border-border text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400"
                      value={newCoachName}
                      onChange={(e) => setNewCoachName(e.target.value)}
                      placeholder="Coach name"
                    />
                  </div>
                  <div>
                    <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                      Coach Email
                    </label>
                    <input
                      className="w-full bg-surface border border-border text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400"
                      value={newCoachEmail}
                      onChange={(e) => setNewCoachEmail(e.target.value)}
                      placeholder="coach@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                    Expected Player Count
                  </label>
                  <input
                    type="number"
                    className="w-full bg-surface border border-border text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400"
                    value={newPlayerCount}
                    onChange={(e) => setNewPlayerCount(e.target.value)}
                    placeholder="e.g. 18"
                  />
                </div>
                <button
                  onClick={submitNewTeam}
                  disabled={addingTeam}
                  className="w-full font-cond font-black text-[13px] tracking-widest bg-navy hover:bg-navy-light text-white py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                  {addingTeam ? 'SUBMITTING...' : 'SUBMIT TEAM REGISTRATION'}
                </button>
                <div className="text-[11px] text-muted font-cond text-center">
                  Team registrations are reviewed by the league administrator before being added to
                  the schedule.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MATCHUPS TAB ── */}
        {tab === 'matchups' && (
          <ProgramMatchupSection
            programTeamIds={new Set(teams.map((t: any) => t.id as number))}
            divTeams={matchupDivTeams}
            divGames={matchupDivGames}
          />
        )}
      </div>

      {/* Schedule Change Request modal */}
      {scrTeamId && (
        <ScheduleChangeRequestModal
          open={scrModalOpen}
          onClose={() => {
            setScrModalOpen(false)
            setScrPreSelectedGameId(undefined)
            setScrTeamId(undefined)
            loadData()
          }}
          preSelectedGameId={scrPreSelectedGameId}
          teamId={scrTeamId}
          teamGames={programGames.filter(
            (g) => g.home_team_id === scrTeamId || g.away_team_id === scrTeamId
          )}
          eventId={portalEventId!}
        />
      )}

      {/* Invoice modal */}
      {showInvoice && eventInfo && program && (
        <InvoiceModal
          data={{
            event: eventInfo,
            program: {
              name: program.name,
              contact_name: program.contact_name ?? null,
              contact_email: program.contact_email ?? null,
              contact_phone: program.contact_phone ?? null,
              logo_url: program.logo_url ?? null,
            },
            payments: programPayments,
            fees: programFees,
            gameCounts: programGameCounts,
          }}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  )
}

// ── Program Matchup Section ────────────────────────────────────────────────────

interface MatchupGame {
  id: number
  home_team_id: number
  away_team_id: number
  division: string
}

interface MatchupTeam {
  id: number
  name: string
  division: string
}

function ProgramMatchupSection({
  programTeamIds,
  divTeams,
  divGames,
}: {
  programTeamIds: Set<number>
  divTeams: MatchupTeam[]
  divGames: MatchupGame[]
}) {
  const divisions = useMemo(() => [...new Set(divTeams.map((t) => t.division))].sort(), [divTeams])

  if (divTeams.length === 0) {
    return (
      <div className="font-cond text-[11px] text-muted text-center py-12">
        No matchup data available yet.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {divisions.map((div) => {
        const divDivTeams = divTeams
          .filter((t) => t.division === div)
          .sort((a, b) => {
            // Program's teams first, then alphabetical
            const aIsMine = programTeamIds.has(a.id)
            const bIsMine = programTeamIds.has(b.id)
            if (aIsMine && !bIsMine) return -1
            if (!aIsMine && bIsMine) return 1
            return a.name.localeCompare(b.name)
          })
        const divDivGames = divGames.filter((g) => g.division === div)
        if (divDivTeams.length === 0) return null

        // Build matrix
        const matrix: Record<number, Record<number, number>> = {}
        for (const g of divDivGames) {
          if (!matrix[g.home_team_id]) matrix[g.home_team_id] = {}
          if (!matrix[g.away_team_id]) matrix[g.away_team_id] = {}
          matrix[g.home_team_id][g.away_team_id] =
            (matrix[g.home_team_id]?.[g.away_team_id] ?? 0) + 1
          matrix[g.away_team_id][g.home_team_id] =
            (matrix[g.away_team_id]?.[g.home_team_id] ?? 0) + 1
        }

        const maxCount = Math.max(
          1,
          ...divDivTeams.flatMap((row) =>
            divDivTeams.map((col) => (row.id !== col.id ? (matrix[row.id]?.[col.id] ?? 0) : 0))
          )
        )

        return (
          <div key={div}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-sm bg-navy" />
              <span className="font-cond text-[14px] font-black tracking-[.12em] text-blue-300 uppercase">
                {div}
              </span>
              <span className="font-cond text-[11px] text-muted ml-1">
                {divDivTeams.length} teams · {divDivGames.length} games
              </span>
            </div>
            <div className="overflow-auto rounded-lg border border-[#1a2d50]">
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr style={{ background: '#081428' }}>
                    <th
                      className="px-3 py-2 border-r border-b border-[#1a2d50] sticky left-0 z-10"
                      style={{ background: '#081428', minWidth: 150 }}
                    >
                      <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">
                        vs →
                      </span>
                    </th>
                    {divDivTeams.map((col) => (
                      <th
                        key={col.id}
                        className="px-2 py-2 border-b border-[#1a2d50]"
                        style={{ minWidth: 64 }}
                      >
                        <div
                          className={cn(
                            'font-cond text-[10px] font-black whitespace-nowrap',
                            programTeamIds.has(col.id) ? 'text-red-300' : 'text-[#8a9ec0]'
                          )}
                          style={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            maxHeight: 100,
                          }}
                          title={col.name}
                        >
                          {col.name.length > 14 ? col.name.slice(0, 13) + '…' : col.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {divDivTeams.map((row, ri) => {
                    const isMine = programTeamIds.has(row.id)
                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: isMine ? '#0a1e38' : ri % 2 === 0 ? '#050f20' : '#030c1a',
                        }}
                      >
                        <td
                          className="px-3 py-1.5 border-r border-[#1a2d50] sticky left-0 z-10"
                          style={{
                            background: isMine ? '#0a1e38' : ri % 2 === 0 ? '#050f20' : '#030c1a',
                          }}
                        >
                          <span
                            className={cn(
                              'font-cond text-[11px] font-bold whitespace-nowrap',
                              isMine ? 'text-red-300' : 'text-white'
                            )}
                            title={row.name}
                          >
                            {row.name.length > 20 ? row.name.slice(0, 19) + '…' : row.name}
                          </span>
                          {isMine && (
                            <span className="ml-1.5 font-cond text-[9px] text-red-500 font-black">
                              ★
                            </span>
                          )}
                        </td>
                        {divDivTeams.map((col) => {
                          const isSelf = row.id === col.id
                          const count = isSelf ? null : (matrix[row.id]?.[col.id] ?? 0)
                          const intensity = isSelf ? 0 : (count ?? 0) / maxCount
                          return (
                            <td
                              key={col.id}
                              className="text-center px-1 py-1.5"
                              style={{ borderLeft: '1px solid #0d1e3a' }}
                            >
                              {isSelf ? (
                                <div
                                  className="w-8 h-6 mx-auto rounded"
                                  style={{ background: '#0d1e3a' }}
                                />
                              ) : count === 0 ? (
                                <div className="font-cond text-[11px] text-[#2a3d5a] font-black">
                                  —
                                </div>
                              ) : (
                                <div
                                  className="w-8 h-6 mx-auto rounded flex items-center justify-center font-mono text-[12px] font-bold text-white"
                                  style={
                                    (count ?? 0) >= 3
                                      ? {
                                          background: 'rgba(214,40,40,0.55)',
                                          border: '1px solid rgba(214,40,40,0.8)',
                                        }
                                      : (count ?? 0) === 2
                                        ? {
                                            background: 'rgba(251,191,36,0.4)',
                                            border: '1px solid rgba(251,191,36,0.7)',
                                          }
                                        : {
                                            background: 'rgba(34,197,94,0.35)',
                                            border: '1px solid rgba(34,197,94,0.6)',
                                          }
                                  }
                                >
                                  {count}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="font-cond text-[9px] font-black text-red-400">★</span>
                <span className="font-cond text-[9px] text-muted">Your team</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-3 rounded"
                  style={{
                    background: 'rgba(34,197,94,0.35)',
                    border: '1px solid rgba(34,197,94,0.6)',
                  }}
                />
                <span className="font-cond text-[9px] text-muted">1 game</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-3 rounded"
                  style={{
                    background: 'rgba(251,191,36,0.4)',
                    border: '1px solid rgba(251,191,36,0.7)',
                  }}
                />
                <span className="font-cond text-[9px] text-muted">2 games</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-3 rounded"
                  style={{
                    background: 'rgba(214,40,40,0.55)',
                    border: '1px solid rgba(214,40,40,0.8)',
                  }}
                />
                <span className="font-cond text-[9px] text-muted">3+ games</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-cond text-[9px] text-[#2a3d5a] font-black">—</span>
                <span className="font-cond text-[9px] text-muted">Not yet played</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
