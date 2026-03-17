'use client'

import { RegistrationConfig } from '@/components/programs/RegistrationConfig'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Btn, SectionHeader } from '@/components/ui'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, Users, Building2, RefreshCw } from 'lucide-react'

interface Program {
  id: number; name: string; short_name: string | null
  association: string | null; city: string | null; state: string | null
  contact_name: string; contact_email: string; contact_phone: string | null
  status: string; notes: string | null; created_at: string
  website: string | null
}

interface TeamReg {
  id: number; program_id: number; team_name: string; division: string
  head_coach_name: string | null; head_coach_email: string | null
  player_count: number | null; status: string; notes: string | null
  program?: { name: string }
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

export function ProgramApprovals() {
  const { user } = useAuth()
  const [programs, setPrograms]   = useState<Program[]>([])
  const [teamRegs, setTeamRegs]   = useState<TeamReg[]>([])
  const [filter, setFilter]       = useState<FilterStatus>('pending')
  const [loading, setLoading]     = useState(true)
  const [actionId, setActionId]   = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'programs' | 'teams' | 'config'>('programs')

  const load = useCallback(async () => {
    const sb = createClient()
    setLoading(true)
    const [{ data: progs }, { data: regs }] = await Promise.all([
      sb.from('programs').select('*').order('created_at', { ascending: false }),
      sb.from('team_registrations').select('*, program:programs(name)').order('created_at', { ascending: false }),
    ])
    setPrograms((progs as Program[]) ?? [])
    setTeamRegs((regs as unknown as TeamReg[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function approveProgram(prog: Program) {
    setActionId(prog.id)
    const sb = createClient()

    // Approve program
    await sb.from('programs').update({
      status:      'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', prog.id)

    // Activate the program leader's account
    await sb.from('user_roles').update({ is_active: true })
      .eq('program_id', prog.id).eq('role', 'program_leader')

    // Auto-approve all pending teams for this program
    const { data: pendingTeams } = await sb
      .from('team_registrations')
      .select('*')
      .eq('program_id', prog.id)
      .eq('status', 'pending')

    let teamsCreated = 0
    for (const reg of pendingTeams ?? []) {
      // Create the actual team record
      const { data: team, error: teamErr } = await sb.from('teams').insert({
        event_id: 1,
        name:     reg.team_name,
        division: reg.division,
      }).select().single()

      if (teamErr || !team) continue

      // Link team to program
      await sb.from('program_teams').insert({
        program_id: prog.id,
        team_id:    (team as any).id,
        event_id:   1,
        division:   reg.division,
      })

      // Mark registration approved
      await sb.from('team_registrations').update({
        status:      'approved',
        team_id:     (team as any).id,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reg.id)

      teamsCreated++
    }

    await sb.from('ops_log').insert({
      event_id:    1,
      message:     `Program approved: ${prog.name} — ${teamsCreated} team(s) auto-created`,
      log_type:    'ok',
      occurred_at: new Date().toISOString(),
    })

    toast.success(`${prog.name} approved — ${teamsCreated} team${teamsCreated !== 1 ? 's' : ''} created`)
    setActionId(null)
    load()
  }

  async function rejectProgram(prog: Program) {
    setActionId(prog.id)
    const sb = createClient()
    await sb.from('programs').update({
      status:         'rejected',
      rejection_note: rejectNote || null,
    }).eq('id', prog.id)
    toast(`${prog.name} rejected`)
    setRejectingId(null)
    setRejectNote('')
    setActionId(null)
    load()
  }

  async function approveTeam(reg: TeamReg) {
    setActionId(reg.id)
    const sb = createClient()

    // Create the actual team record
    const { data: team, error } = await sb.from('teams').insert({
      event_id: 1,
      name:     reg.team_name,
      division: reg.division,
    }).select().single()

    if (error) { toast.error(error.message); setActionId(null); return }

    // Link team to program
    await sb.from('program_teams').insert({
      program_id: reg.program_id,
      team_id:    team.id,
      event_id:   1,
      division:   reg.division,
    })

    // Update registration status
    await sb.from('team_registrations').update({
      status:      'approved',
      team_id:     team.id,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', reg.id)

    await sb.from('ops_log').insert({
      event_id:    1,
      message:     `Team approved: ${reg.team_name} (${reg.division}) — Team #${team.id} created`,
      log_type:    'ok',
      occurred_at: new Date().toISOString(),
    })

    toast.success(`${reg.team_name} approved — Team #${team.id} created`)
    setActionId(null)
    load()
  }

  async function rejectTeam(reg: TeamReg) {
    setActionId(reg.id)
    const sb = createClient()
    await sb.from('team_registrations').update({
      status:         'rejected',
      rejection_note: rejectNote || null,
      reviewed_by:    user?.id,
      reviewed_at:    new Date().toISOString(),
    }).eq('id', reg.id)
    toast(`${reg.team_name} rejected`)
    setRejectingId(null)
    setRejectNote('')
    setActionId(null)
    load()
  }

  const filteredPrograms = programs.filter(p => filter === 'all' || p.status === filter)
  const filteredTeams    = teamRegs.filter(t => filter === 'all' || t.status === filter)
  const pendingPrograms  = programs.filter(p => p.status === 'pending').length
  const pendingTeams     = teamRegs.filter(t => t.status === 'pending').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionHeader>PROGRAM & TEAM REGISTRATIONS</SectionHeader>
        <Btn size="sm" variant="ghost" onClick={load}>
          <RefreshCw size={11} className="inline mr-1" /> REFRESH
        </Btn>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('programs')}
          className={cn('font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
            activeTab === 'programs' ? 'bg-navy border-blue-400 text-white' : 'bg-surface-card border-border text-muted hover:text-white'
          )}>
          Programs {pendingPrograms > 0 && <span className="ml-1 text-yellow-400">({pendingPrograms} pending)</span>}
        </button>
        <button onClick={() => setActiveTab('teams')}
          className={cn('font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
            activeTab === 'teams' ? 'bg-navy border-blue-400 text-white' : 'bg-surface-card border-border text-muted hover:text-white'
          )}>
          Teams {pendingTeams > 0 && <span className="ml-1 text-yellow-400">({pendingTeams} pending)</span>}
        </button>

        {/* Filter */}
        <button onClick={() => setActiveTab('config')}
          className={cn('font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
            activeTab === 'config' ? 'bg-navy border-blue-400 text-white' : 'bg-surface-card border-border text-muted hover:text-white'
          )}>
          ⚙ Form Config
        </button>
        <div className="ml-auto flex gap-1">
          {(['pending','approved','rejected','all'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('font-cond text-[11px] font-bold px-3 py-1.5 rounded transition-colors',
                filter === f ? 'bg-navy text-white' : 'bg-surface-card border border-border text-muted hover:text-white'
              )}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted font-cond">LOADING...</div>
      ) : (
        <>
          {/* Programs list */}
          {activeTab === 'programs' && (
            <div className="space-y-3">
              {filteredPrograms.length === 0 && (
                <div className="text-center py-12 text-muted font-cond">No programs matching filter</div>
              )}
              {filteredPrograms.map(prog => (
                <div key={prog.id} className={cn(
                  'bg-surface-card border rounded-xl p-4',
                  prog.status === 'pending' ? 'border-yellow-700/50' :
                  prog.status === 'approved' ? 'border-green-700/40' : 'border-border'
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Building2 size={16} className="text-muted flex-shrink-0" />
                        <div className="font-cond font-black text-[16px] text-white">{prog.name}</div>
                        {prog.short_name && <span className="font-cond text-[11px] text-blue-300">{prog.short_name}</span>}
                        <span className={cn('font-cond text-[10px] font-black px-2 py-0.5 rounded tracking-wider',
                          prog.status === 'approved' ? 'bg-green-900/40 text-green-400' :
                          prog.status === 'pending'  ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-red-900/30 text-red-400'
                        )}>{prog.status.toUpperCase()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-[11px] mt-2">
                        <div><span className="text-muted">Contact: </span><span className="text-white">{prog.contact_name}</span></div>
                        <div><span className="text-muted">Email: </span><span className="text-blue-300">{prog.contact_email}</span></div>
                        <div><span className="text-muted">Location: </span><span className="text-white">{[prog.city, prog.state].filter(Boolean).join(', ')}</span></div>
                        {prog.association && <div><span className="text-muted">Association: </span><span className="text-white">{prog.association}</span></div>}
                        {prog.contact_phone && <div><span className="text-muted">Phone: </span><span className="text-white">{prog.contact_phone}</span></div>}
                        <div><span className="text-muted">Submitted: </span><span className="text-white">{new Date(prog.created_at).toLocaleDateString()}</span></div>
                      </div>
                      {prog.notes && (
                        <div className="mt-2 text-[11px] bg-navy/30 rounded px-3 py-2 text-muted italic">"{prog.notes}"</div>
                      )}
                    </div>

                    {prog.status === 'pending' && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {rejectingId === prog.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              className="bg-surface border border-border text-white px-2 py-1 rounded text-[12px] outline-none w-48"
                              placeholder="Rejection reason (optional)"
                              value={rejectNote}
                              onChange={e => setRejectNote(e.target.value)}
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => rejectProgram(prog)} disabled={actionId === prog.id}
                                className="flex-1 font-cond text-[11px] font-bold bg-red-800 hover:bg-red-700 text-white py-1.5 rounded transition-colors">
                                CONFIRM
                              </button>
                              <button onClick={() => setRejectingId(null)}
                                className="font-cond text-[11px] text-muted px-2 py-1.5 rounded border border-border hover:text-white">
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => approveProgram(prog)} disabled={actionId === prog.id}
                              className="flex items-center gap-1.5 font-cond text-[12px] font-bold bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                              <CheckCircle size={13} /> APPROVE
                            </button>
                            <button onClick={() => setRejectingId(prog.id)}
                              className="flex items-center gap-1.5 font-cond text-[12px] font-bold bg-surface-card border border-red-800/50 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors">
                              <XCircle size={13} /> REJECT
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Teams list */}
          {activeTab === 'teams' && (
            <div className="space-y-3">
              {filteredTeams.length === 0 && (
                <div className="text-center py-12 text-muted font-cond">No team registrations matching filter</div>
              )}
              {filteredTeams.map(reg => (
                <div key={reg.id} className={cn(
                  'bg-surface-card border rounded-xl p-4',
                  reg.status === 'pending' ? 'border-yellow-700/50' :
                  reg.status === 'approved' ? 'border-green-700/40' : 'border-border'
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="font-cond font-black text-[16px] text-white">{reg.team_name}</div>
                        <span className="font-cond text-[11px] text-blue-300">{reg.division}</span>
                        <span className={cn('font-cond text-[10px] font-black px-2 py-0.5 rounded tracking-wider',
                          reg.status === 'approved' ? 'bg-green-900/40 text-green-400' :
                          reg.status === 'pending'  ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-red-900/30 text-red-400'
                        )}>{reg.status.toUpperCase()}</span>
                      </div>
                      <div className="font-cond text-[11px] text-muted mb-2">
                        Program: <span className="text-white">{(reg.program as any)?.name}</span>
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        {reg.head_coach_name && <span className="text-muted">Coach: <span className="text-white">{reg.head_coach_name}</span></span>}
                        {reg.head_coach_email && <span className="text-muted">Email: <span className="text-blue-300">{reg.head_coach_email}</span></span>}
                        {reg.player_count && <span className="text-muted">Players: <span className="text-white">{reg.player_count}</span></span>}
                      </div>
                    </div>

                    {reg.status === 'pending' && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {rejectingId === reg.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              className="bg-surface border border-border text-white px-2 py-1 rounded text-[12px] outline-none w-48"
                              placeholder="Rejection reason (optional)"
                              value={rejectNote}
                              onChange={e => setRejectNote(e.target.value)}
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => rejectTeam(reg)} disabled={actionId === reg.id}
                                className="flex-1 font-cond text-[11px] font-bold bg-red-800 hover:bg-red-700 text-white py-1.5 rounded">
                                CONFIRM
                              </button>
                              <button onClick={() => setRejectingId(null)}
                                className="font-cond text-[11px] text-muted px-2 py-1.5 rounded border border-border hover:text-white">
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => approveTeam(reg)} disabled={actionId === reg.id}
                              className="flex items-center gap-1.5 font-cond text-[12px] font-bold bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                              <CheckCircle size={13} /> APPROVE + CREATE TEAM
                            </button>
                            <button onClick={() => setRejectingId(reg.id)}
                              className="flex items-center gap-1.5 font-cond text-[12px] font-bold bg-surface-card border border-red-800/50 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors">
                              <XCircle size={13} /> REJECT
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'config' && <RegistrationConfig />}
        </>
      )}
    </div>
  )
}
