import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createUserSchema } from '@/schemas/admin'

export async function POST(req: NextRequest) {
  // 1. Auth guard (SEC-02) — verify requester is authenticated
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify requester has admin role
  const { data: roleCheck } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleCheck) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // 2. Parse raw JSON body (SEC-07)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Zod validation (SEC-07)
  const result = createUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.flatten() }, { status: 400 })
  }

  // 4. Business logic
  const {
    email,
    password,
    role,
    display_name,
    referee_id,
    volunteer_id,
    program_id,
    coach_id,
    trainer_id,
    event_id,
  } = result.data

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let newUserId: string

  if (serviceKey) {
    // Preferred: use admin API so email is auto-confirmed regardless of project settings
    const adminSb = createAdminClient(url, serviceKey, {
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

    // For program_leader role, also insert into program_leaders table
    if (role === 'program_leader' && program_id) {
      await adminSb.from('program_leaders').insert({
        user_id: newUserId,
        program_id,
        is_primary: true,
      })
    }
  } else {
    // Fallback: signUp works when email autoconfirm is enabled in Supabase project settings
    const signupSb = createAdminClient(url, anonKey, {
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
  const { error: roleError } = await supabase.from('user_roles').insert({
    user_id: newUserId,
    role,
    display_name: display_name ?? email,
    referee_id: referee_id ?? null,
    volunteer_id: volunteer_id ?? null,
    program_id: program_id ?? null,
    coach_id: coach_id ?? null,
    trainer_id: trainer_id ?? null,
    event_id: event_id,
    is_active: true,
  })

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  // Grant event access so they can see the event in EventPicker
  if (event_id) {
    await supabase
      .from('event_admins')
      .upsert({ event_id, user_id: newUserId, role }, { onConflict: 'event_id,user_id' })
  }

  // Log it
  await supabase.from('ops_log').insert({
    event_id: event_id ?? 1,
    message: `User created: ${email} (${role}) by admin`,
    log_type: 'info',
    occurred_at: new Date().toISOString(),
  })

  return NextResponse.json({ created: true, user_id: newUserId }, { status: 201 })
}
