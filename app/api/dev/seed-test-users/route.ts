import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const TEST_PASSWORD = 'testpass1234'

const TEST_ACCOUNTS = [
  {
    email: 'admin@test.leagueops.dev',
    role: 'admin',
    display_name: 'Test Admin',
    event_id: 11,
  },
  {
    email: 'coach@test.leagueops.dev',
    role: 'coach',
    display_name: 'Test Coach',
    event_id: 11,
    team_id: 117,
  },
  {
    email: 'referee@test.leagueops.dev',
    role: 'referee',
    display_name: 'Test Referee',
    event_id: 11,
    referee_id: 17,
  },
  {
    email: 'volunteer@test.leagueops.dev',
    role: 'volunteer',
    display_name: 'Test Volunteer',
    event_id: 11,
    volunteer_id: null,
  },
  {
    email: 'program@test.leagueops.dev',
    role: 'program_leader',
    display_name: 'Test Program Leader',
    event_id: 11,
  },
  {
    email: 'trainer@test.leagueops.dev',
    role: 'trainer',
    display_name: 'Test Trainer',
    event_id: 11,
  },
]

export async function POST() {
  // Gate: only allow when test login is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Test login not enabled' }, { status: 403 })
  }

  const adminSb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const results: { email: string; status: string }[] = []

  for (const account of TEST_ACCOUNTS) {
    try {
      // Try to create the auth user
      const { data: newUser, error: createError } = await adminSb.auth.admin.createUser({
        email: account.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      })

      let userId: string

      if (createError) {
        // User might already exist — look them up
        if (createError.message.includes('already been registered')) {
          const { data: listData } = await adminSb.auth.admin.listUsers()
          const existing = listData?.users?.find((u) => u.email === account.email)
          if (!existing) {
            results.push({ email: account.email, status: `error: ${createError.message}` })
            continue
          }
          userId = existing.id
        } else {
          results.push({ email: account.email, status: `error: ${createError.message}` })
          continue
        }
      } else {
        userId = newUser.user.id
      }

      // Upsert the role — check if it already exists
      const { data: existingRole } = await adminSb
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', account.role)
        .maybeSingle()

      if (!existingRole) {
        const { error: roleError } = await adminSb.from('user_roles').insert({
          user_id: userId,
          role: account.role,
          display_name: account.display_name,
          event_id: account.event_id,
          referee_id: (account as any).referee_id ?? null,
          volunteer_id: (account as any).volunteer_id ?? null,
          team_id: (account as any).team_id ?? null,
          is_active: true,
        })

        if (roleError) {
          results.push({ email: account.email, status: `role error: ${roleError.message}` })
          continue
        }
      }

      // Ensure event_admins row exists for roles that use EventPicker (admin, coach, trainer, program_leader)
      const eventPickerRoles = ['admin', 'coach', 'trainer', 'program_leader']
      if (eventPickerRoles.includes(account.role)) {
        await adminSb
          .from('event_admins')
          .upsert(
            { user_id: userId, event_id: account.event_id },
            { onConflict: 'user_id,event_id', ignoreDuplicates: true }
          )
      }

      results.push({ email: account.email, status: 'ok' })
    } catch (err: any) {
      results.push({ email: account.email, status: `error: ${err.message}` })
    }
  }

  return NextResponse.json({ seeded: results })
}
