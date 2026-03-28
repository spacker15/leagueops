import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/supabase/server'
import { createClient } from '@supabase/supabase-js'

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let newUserId: string

  if (serviceKey) {
    // Preferred: use admin API so email is auto-confirmed regardless of project settings
    const adminSb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: newUser, error: createError } = await adminSb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
    newUserId = newUser.user.id
  } else {
    // Fallback: signUp works when email autoconfirm is enabled in Supabase project settings
    const signupSb = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: signupData, error: createError } = await signupSb.auth.signUp({
      email,
      password,
    })
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
    if (!signupData.user) {
      return NextResponse.json(
        { error: 'User creation failed — check that email autoconfirm is enabled in Supabase' },
        { status: 500 }
      )
    }
    newUserId = signupData.user.id
  }

  // Create the role record
  const { error: roleError } = await sb.from('user_roles').insert({
    user_id: newUserId,
    role,
    display_name: display_name ?? email,
    referee_id: referee_id ?? null,
    volunteer_id: volunteer_id ?? null,
    event_id: event_id ?? 1,
    is_active: true,
  })

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  // Grant event access so they can see the event in EventPicker
  if (event_id) {
    await sb
      .from('event_admins')
      .upsert({ event_id, user_id: newUserId, role }, { onConflict: 'event_id,user_id' })
  }

  // Log it
  await sb.from('ops_log').insert({
    event_id: event_id ?? 1,
    message: `User created: ${email} (${role}) by admin`,
    log_type: 'info',
    occurred_at: new Date().toISOString(),
  })

  return NextResponse.json({ created: true, user_id: newUserId }, { status: 201 })
}
