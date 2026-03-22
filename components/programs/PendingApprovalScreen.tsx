'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { Clock, CheckCircle, XCircle, LogOut, RefreshCw } from 'lucide-react'

interface Program {
  id: number
  name: string
  short_name: string | null
  status: string
  contact_name: string
  contact_email: string
  logo_url: string | null
  rejection_note: string | null
  created_at: string
}

interface TeamReg {
  id: number
  team_name: string
  division: string
  status: string
}

export function PendingApprovalScreen() {
  const { userRole, signOut } = useAuth()
  const [program, setProgram] = useState<Program | null>(null)
  const [teams, setTeams] = useState<TeamReg[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [userRole])

  async function loadStatus() {
    if (!userRole?.program_id) return
    const sb = createClient()
    const [{ data: prog }, { data: teamData }] = await Promise.all([
      sb.from('programs').select('*').eq('id', userRole.program_id).single(),
      sb
        .from('team_registrations')
        .select('id, team_name, division, status')
        .eq('program_id', userRole.program_id),
    ])
    setProgram(prog as Program)
    setTeams((teamData as TeamReg[]) ?? [])
    setLoading(false)
  }

  async function checkStatus() {
    setChecking(true)
    await loadStatus()
    setChecking(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )
  }

  const isRejected = program?.status === 'rejected'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red rounded flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.4" />
            </svg>
          </div>
          <span className="font-cond text-xl font-black tracking-widest text-white">LEAGUEOPS</span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 font-cond text-[11px] text-muted hover:text-white transition-colors"
        >
          <LogOut size={13} /> SIGN OUT
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Status icon */}
          <div className="text-center mb-8">
            <div
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5',
                isRejected
                  ? 'bg-red-900/30 border-2 border-red-600/50'
                  : 'bg-yellow-900/20 border-2 border-yellow-600/40'
              )}
            >
              {program?.logo_url ? (
                <img
                  src={program.logo_url}
                  alt=""
                  className="w-14 h-14 object-contain rounded-full"
                />
              ) : isRejected ? (
                <XCircle size={36} className="text-red-400" />
              ) : (
                <Clock size={36} className="text-yellow-400" />
              )}
            </div>

            <div
              className={cn(
                'font-cond font-black text-[26px] tracking-wide mb-2',
                isRejected ? 'text-red-400' : 'text-yellow-400'
              )}
            >
              {isRejected ? 'REGISTRATION NOT APPROVED' : 'PENDING APPROVAL'}
            </div>

            <div className="font-cond text-[14px] text-white font-bold mb-1">{program?.name}</div>
            <div className="font-cond text-[12px] text-muted">
              {program?.contact_name} · {program?.contact_email}
            </div>
          </div>

          {/* Status card */}
          <div
            className={cn(
              'rounded-xl border p-6 mb-5',
              isRejected
                ? 'bg-red-900/10 border-red-800/50'
                : 'bg-yellow-900/10 border-yellow-800/40'
            )}
          >
            {isRejected ? (
              <div>
                <div className="font-cond font-black text-[14px] text-red-400 mb-3">
                  YOUR REGISTRATION WAS NOT APPROVED
                </div>
                <div className="font-cond text-[13px] text-gray-300 leading-relaxed mb-3">
                  Unfortunately your program registration was not approved at this time.
                </div>
                {program?.rejection_note && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-3">
                    <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-1">
                      NOTE FROM ADMINISTRATOR
                    </div>
                    <div className="font-cond text-[13px] text-red-200 italic">
                      "{program.rejection_note}"
                    </div>
                  </div>
                )}
                <div className="font-cond text-[12px] text-muted">
                  Please contact the league administrator if you have questions.
                </div>
              </div>
            ) : (
              <div>
                <div className="font-cond font-black text-[14px] text-yellow-400 mb-3">
                  YOUR REGISTRATION IS UNDER REVIEW
                </div>
                <div className="font-cond text-[13px] text-gray-300 leading-relaxed">
                  The league administrator will review your program and team registrations. Once
                  approved you'll have full access to manage your teams and rosters. This typically
                  takes <span className="text-white font-bold">1–2 business days</span>.
                </div>
              </div>
            )}
          </div>

          {/* Submitted teams */}
          {teams.length > 0 && (
            <div className="bg-surface-card border border-border rounded-xl p-5 mb-5">
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-3">
                YOUR SUBMITTED TEAMS ({teams.length})
              </div>
              <div className="space-y-2">
                {teams.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-[12px]">
                    <div>
                      <span className="font-cond font-bold text-white">{t.team_name}</span>
                      <span className="font-cond text-muted ml-2">{t.division}</span>
                    </div>
                    <span
                      className={cn(
                        'font-cond text-[10px] font-black px-2 py-0.5 rounded tracking-wider',
                        t.status === 'approved'
                          ? 'bg-green-900/40 text-green-400'
                          : t.status === 'rejected'
                            ? 'bg-red-900/40 text-red-400'
                            : t.status === 'waitlist'
                              ? 'bg-orange-900/40 text-orange-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                      )}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!isRejected && (
              <button
                onClick={checkStatus}
                disabled={checking}
                className="flex items-center justify-center gap-2 w-full font-cond font-black text-[13px] tracking-wider bg-navy hover:bg-navy-light text-white py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                {checking ? 'CHECKING...' : 'CHECK APPROVAL STATUS'}
              </button>
            )}

            <div className="text-center">
              <button
                onClick={signOut}
                className="font-cond text-[12px] text-muted hover:text-white transition-colors"
              >
                Sign out and return to login
              </button>
            </div>
          </div>

          <div className="text-center mt-6 font-cond text-[10px] text-muted">
            Submitted{' '}
            {new Date(program?.created_at ?? '').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
