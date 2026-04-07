import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { updateUserSchema } from '@/schemas/admin'

export async function POST(req: NextRequest) {
  // Auth guard — verify requester is authenticated
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

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate
  const result = updateUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.flatten() }, { status: 400 })
  }

  const { user_id, role_id, password, display_name, email } = result.data

  const adminSb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update auth user (password and/or email)
  const authUpdate: { password?: string; email?: string } = {}
  if (password) authUpdate.password = password
  if (email) authUpdate.email = email

  if (Object.keys(authUpdate).length > 0) {
    const { error: updateError } = await adminSb.auth.admin.updateUserById(user_id, authUpdate)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }
  }

  // Update display_name in user_roles if provided
  if (display_name) {
    const { error: roleError } = await adminSb
      .from('user_roles')
      .update({ display_name })
      .eq('id', role_id)

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }
  }

  // Log action
  const actions: string[] = []
  if (password) actions.push('password reset')
  if (display_name) actions.push('name updated')
  if (email) actions.push('email updated')

  if (actions.length > 0) {
    // Get the event_id from the role record for logging
    const { data: roleData } = await adminSb
      .from('user_roles')
      .select('event_id')
      .eq('id', role_id)
      .single()

    if (roleData?.event_id) {
      await adminSb.from('ops_log').insert({
        event_id: roleData.event_id,
        message: `User ${user_id} updated (${actions.join(', ')}) by admin`,
        log_type: 'info',
        occurred_at: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({ updated: true })
}
