import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, email, password, display_name } = body as {
    token?: string
    email?: string
    password?: string
    display_name?: string
  }

  if (!token || !email || !password) {
    return NextResponse.json({ error: 'Token, email, and password are required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const adminSb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Validate token → get program + event
  const { data: invite } = await adminSb
    .from('program_invites')
    .select('id, program_id, event_id, is_active')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  }

  // Get program name for display
  const { data: program } = await adminSb
    .from('programs')
    .select('name, contact_name')
    .eq('id', invite.program_id)
    .single()

  // Create auth user
  const { data: newUser, error: createError } = await adminSb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message.includes('already been registered')) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in instead.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  const userId = newUser.user.id
  const name = display_name || program?.contact_name || email

  // Create user_roles record
  const { error: roleError } = await adminSb.from('user_roles').insert({
    user_id: userId,
    role: 'program_leader',
    display_name: name,
    program_id: invite.program_id,
    event_id: invite.event_id,
    is_active: true,
  })

  if (roleError) {
    await adminSb.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  // Create program_leaders record
  await adminSb.from('program_leaders').insert({
    user_id: userId,
    program_id: invite.program_id,
    is_primary: true,
  })

  // Log it
  await adminSb.from('ops_log').insert({
    event_id: invite.event_id,
    message: `Program leader registered: ${email} for ${program?.name ?? 'program'}`,
    log_type: 'info',
    occurred_at: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    message: 'Account created. You can now sign in.',
    program_name: program?.name,
  })
}
