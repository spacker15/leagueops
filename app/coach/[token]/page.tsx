import { createClient } from '@/lib/supabase/server'
import { Clock, XCircle } from 'lucide-react'
import { CoachJoinClient } from './CoachJoinClient'

export default async function CoachPage({ params }: { params: { token: string } }) {
  const sb = await createClient()

  // 1. Fetch invite with joined program and event data
  const { data: invite } = await sb
    .from('coach_invites')
    .select(
      `
      id, program_id, event_id, token, is_active, expires_at,
      programs(name),
      events(name, primary_color, logo_url, registration_opens_at, registration_closes_at, registration_open)
    `
    )
    .eq('token', params.token)
    .single()

  // 2. Validate: missing, inactive, expired, or registration closed
  const now = new Date()
  const isExpired = invite?.expires_at ? new Date(invite.expires_at) < now : false
  const regManualClosed = invite?.events ? (invite.events as any).registration_open === false : false
  const regDateClosed = invite?.events
    ? ((invite.events as any).registration_opens_at &&
        new Date((invite.events as any).registration_opens_at) > now) ||
      ((invite.events as any).registration_closes_at &&
        new Date((invite.events as any).registration_closes_at) < now)
    : false
  const isInvalid = !invite || !invite.is_active || isExpired || regManualClosed || regDateClosed

  if (isInvalid) {
    // Determine error reason for display
    const reason = !invite
      ? 'invalid'
      : !invite.is_active
        ? 'used'
        : isExpired
          ? 'expired'
          : regManualClosed || regDateClosed
            ? 'closed'
            : 'invalid'
    const eventName = invite?.events ? (invite.events as any).name : null
    const eventLogo = invite?.events ? (invite.events as any).logo_url : null
    const programName = invite?.programs ? (invite.programs as any).name : null

    return (
      <div className="min-h-screen bg-[#020810] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Red accent bar at top */}
          <div className="h-1.5 bg-[#D62828] rounded-t-2xl" />
          <div className="bg-[#081428] border border-[#1a2d50] rounded-b-2xl p-8 text-center">
            {eventLogo && (
              <img src={eventLogo} alt="" className="w-16 h-16 mx-auto mb-4 rounded-full" />
            )}
            {eventName && (
              <p className="font-cond font-black text-[18px] text-white mb-4">{eventName}</p>
            )}
            {/* Clock or X icon */}
            <div className="mb-4 flex justify-center">
              {reason === 'expired' || reason === 'closed' ? (
                <Clock size={24} className="text-red-400" />
              ) : (
                <XCircle size={24} className="text-red-400" />
              )}
            </div>
            <h1 className="font-cond font-black text-[18px] text-white mb-2">
              {reason === 'expired'
                ? 'This invite link has expired'
                : reason === 'used'
                  ? 'This link has already been used'
                  : reason === 'closed'
                    ? 'Registration is currently closed'
                    : 'This invite link is invalid. Please check the URL and try again.'}
            </h1>
            <p className="text-[13px] text-[#5a6e9a]">
              Please contact your program leader for a new invite link.
            </p>
            {programName && (
              <p className="text-[12px] text-[#5a6e9a] mt-2">Program: {programName}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 3. Load teams for this program+event so coach can select team
  const { data: teams } = await sb
    .from('team_registrations')
    .select('id, team_name, division')
    .eq('program_id', invite.program_id)
    .eq('event_id', invite.event_id)

  // 4. Pass props to client form
  return (
    <CoachJoinClient
      token={params.token}
      inviteId={invite.id}
      programId={invite.program_id}
      eventId={invite.event_id}
      eventName={(invite.events as any)?.name ?? 'Event'}
      primaryColor={(invite.events as any)?.primary_color ?? '#0B3D91'}
      logoUrl={(invite.events as any)?.logo_url ?? null}
      programName={(invite.programs as any)?.name ?? 'Program'}
      teams={teams ?? []}
    />
  )
}
