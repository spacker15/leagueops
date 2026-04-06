import { createClient } from '@/supabase/server'
import { JoinClient } from './JoinClient'

export default async function JoinPage({ params }: { params: { token: string } }) {
  const sb = createClient()

  const { data: invite } = await sb
    .from('registration_invites')
    .select('type, event_id, is_active, events(name, primary_color, logo_url)')
    .eq('token', params.token)
    .single()

  if (!invite || !invite.is_active) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'var(--surface)' }}
      >
        <div className="bg-[#081428] border border-red-800/50 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="font-cond font-black text-[18px] text-red-400 mb-2">INVALID LINK</div>
          <div className="font-cond text-[12px] text-[#5a6e9a]">
            This registration link is invalid or has expired. Contact your event coordinator.
          </div>
        </div>
      </div>
    )
  }

  const event = invite.events as any

  return (
    <JoinClient
      token={params.token}
      type={invite.type as 'referee' | 'volunteer' | 'trainer'}
      eventName={event?.name ?? 'Event'}
      primaryColor={event?.primary_color ?? '#0B3D91'}
      logoUrl={event?.logo_url ?? null}
    />
  )
}
