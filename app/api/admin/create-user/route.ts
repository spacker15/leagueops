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
    event_id,
  } = result.data

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
    program_id: program_id ?? null,
    coach_id: coach_id ?? null,
    event_id: event_id,
    is_active: true,
  })

  if (roleError) {
    // Cleanup: delete the auth user if role insert failed
    await adminSb.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  // For program_leader role, also insert into program_leaders table
  if (role === 'program_leader' && program_id) {
    await adminSb.from('program_leaders').insert({
      user_id: newUser.user.id,
      program_id,
      is_primary: true,
    })
  }

  // Log it
  await adminSb.from('ops_log').insert({
    event_id: event_id,
    message: `User created: ${email} (${role}) by admin`,
    log_type: 'info',
    occurred_at: new Date().toISOString(),
  })

  return NextResponse.json({ created: true, user_id: newUser.user.id }, { status: 201 })
}
