import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/supabase/server'

// POST /api/join/coach — validate program invite token, create auth user + user_role
export async function POST(req: NextRequest) {
  const { token, first_name, last_name, email, password } = await req.json()

  if (!token || !first_name?.trim() || !last_name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const sb = createClient()

  // Validate token
  const { data: invite } = await sb
    .from('program_invites')
    .select('id, program_id, event_id, invited_email, invited_role, is_active, used_at')
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active || invite.used_at) {
    return NextResponse.json(
      { error: 'This invite link is invalid or has already been used.' },
      { status: 404 }
    )
  }

  // Look up program name for display_name
  const { data: program } = await sb
    .from('programs')
    .select('name, short_name')
    .eq('id', invite.program_id)
    .single()

  const displayName = `${first_name.trim()} ${last_name.trim()}`
  const roleName = invite.invited_role as 'coach' | 'assistant_coach'

  // Use admin client to create auth user
  const adminSb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if user with this email already exists
  const { data: listData } = await adminSb.auth.admin.listUsers()
  const existingUser = listData?.users?.find((u) => u.email === email.trim().toLowerCase())

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data: newUser, error: createError } = await adminSb.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
    userId = newUser.user.id
  }

  // Check if this user already has this role for this program
  const { data: existingRole } = await adminSb
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', roleName)
    .eq('program_id', invite.program_id)
    .maybeSingle()

  if (!existingRole) {
    const { error: roleError } = await adminSb.from('user_roles').insert({
      user_id: userId,
      role: roleName,
      display_name: displayName,
      event_id: invite.event_id,
      program_id: invite.program_id,
      is_active: true,
    })
    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    // Add to event_admins so they show up in event picker
    await adminSb
      .from('event_admins')
      .upsert(
        { user_id: userId, event_id: invite.event_id },
        { onConflict: 'user_id,event_id', ignoreDuplicates: true }
      )
  }

  // Mark invite as used
  await adminSb
    .from('program_invites')
    .update({ used_at: new Date().toISOString(), is_active: false })
    .eq('id', invite.id)

  return NextResponse.json({
    success: true,
    program_name: program?.name ?? 'your program',
    role: roleName,
  })
}
