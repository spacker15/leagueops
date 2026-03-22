import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Verify requester is admin
  const sb = createServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: roleCheck } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleCheck) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { email, password, role, display_name, referee_id, volunteer_id, event_id } = body

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password, role required' }, { status: 400 })
  }

  // Use service role client to create auth user
  const adminSb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create the auth user
  const { data: newUser, error: createError } = await adminSb.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm so they can log in immediately
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Create the role record
  const { error: roleError } = await adminSb.from('user_roles').insert({
    user_id: newUser.user.id,
    role,
    display_name: display_name ?? email,
    referee_id: referee_id ?? null,
    volunteer_id: volunteer_id ?? null,
    event_id: event_id ?? 1,
    is_active: true,
  })

  if (roleError) {
    // Cleanup: delete the auth user if role insert failed
    await adminSb.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  // Log it
  await adminSb.from('ops_log').insert({
    event_id: event_id ?? 1,
    message: `User created: ${email} (${role}) by admin`,
    log_type: 'info',
    occurred_at: new Date().toISOString(),
  })

  return NextResponse.json({ created: true, user_id: newUser.user.id }, { status: 201 })
}
