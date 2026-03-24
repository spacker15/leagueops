import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { InviteEmail } from '@/emails/InviteEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const sb = createClient()

  // Verify caller is admin
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: role } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'super_admin', 'league_admin'])
    .single()
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, name, roleName, eventId } = await req.json()

  if (!email || !name || !roleName || !eventId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  // Get event info for branding
  const { data: event } = await sb
    .from('events')
    .select('name, logo_url')
    .eq('id', eventId)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leagueops.vercel.app'

  const html = await render(
    InviteEmail({
      eventName: event.name,
      logoUrl: event.logo_url,
      recipientName: name,
      role: roleName,
      appUrl,
    })
  )

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'LeagueOps <noreply@leagueops.app>'

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: email,
    subject: `You've been added as a ${roleName.replace(/_/g, ' ')} for ${event.name}`,
    html,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
