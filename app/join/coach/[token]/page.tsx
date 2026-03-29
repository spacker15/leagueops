import { createClient } from '@/supabase/server'
import { CoachJoinClient } from './CoachJoinClient'

export default async function CoachJoinPage({ params }: { params: { token: string } }) {
  const sb = createClient()

  const { data: invite } = await sb
    .from('program_invites')
    .select(
      'invited_role, invited_email, is_active, used_at, program:programs(name, logo_url), event:events(name, primary_color)'
    )
    .eq('token', params.token)
    .single()

  if (!invite || !invite.is_active || invite.used_at) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: '#020810' }}
      >
        <div className="bg-[#081428] border border-red-800/50 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="font-cond font-black text-[18px] text-red-400 mb-2">INVALID LINK</div>
          <div className="font-cond text-[12px] text-[#5a6e9a]">
            This invite link is invalid, expired, or has already been used. Contact your program
            leader for a new link.
          </div>
        </div>
      </div>
    )
  }

  const program = invite.program as any
  const event = invite.event as any

  return (
    <CoachJoinClient
      token={params.token}
      invitedRole={invite.invited_role as 'coach' | 'assistant_coach'}
      invitedEmail={invite.invited_email}
      programName={program?.name ?? 'Your Program'}
      eventName={event?.name ?? 'Event'}
      primaryColor={event?.primary_color ?? '#0B3D91'}
      logoUrl={program?.logo_url ?? null}
    />
  )
}
