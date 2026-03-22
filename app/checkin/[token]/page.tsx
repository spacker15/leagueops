import { createClient } from '@/supabase/server'
import { QRCheckinClient } from './QRCheckinClient'

export default async function QRCheckinPage({ params }: { params: { token: string } }) {
  const sb = createClient()
  const token = params.token

  // Look up the token
  const { data: tokenData } = await sb
    .from('player_qr_tokens')
    .select(
      `
      token, player_id, event_id,
      player:players(id, name, number, position,
        team:teams(id, name, division)
      )
    `
    )
    .eq('token', token)
    .single()

  if (!tokenData) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-surface-card border border-red-800/50 rounded-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="font-cond font-black text-[18px] text-red-400 mb-2">INVALID QR CODE</div>
          <div className="font-cond text-[12px] text-muted">
            This QR code is not recognized. Contact your team administrator.
          </div>
        </div>
      </div>
    )
  }

  // Find their current/next game
  const { data: games } = await sb
    .from('games')
    .select(
      `
      id, scheduled_time, status, division,
      field:fields(name),
      home_team:teams!games_home_team_id_fkey(id, name),
      away_team:teams!games_away_team_id_fkey(id, name)
    `
    )
    .eq('event_id', tokenData.event_id)
    .in('status', ['Scheduled', 'Starting', 'Live', 'Halftime'])
    .or(
      `home_team_id.eq.${(tokenData.player as any).team?.id},away_team_id.eq.${(tokenData.player as any).team?.id}`
    )
    .order('scheduled_time')

  // Check if already checked in to any game
  const { data: existingCheckins } = await sb
    .from('player_checkins')
    .select('game_id')
    .eq('player_id', tokenData.player_id)

  const checkedInGameIds = (existingCheckins ?? []).map((c: any) => c.game_id)

  return (
    <QRCheckinClient
      token={token}
      player={tokenData.player as any}
      games={(games ?? []) as any[]}
      checkedInGameIds={checkedInGameIds}
      eventId={tokenData.event_id}
    />
  )
}
