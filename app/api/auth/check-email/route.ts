import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

/**
 * Checks if an email is already registered and what role it has.
 * Used during registration to prevent duplicate accounts.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const sb = createClient()

  // Check user_roles for any record with this email via auth.users
  // We do this by checking if a sign-in would work (try to get user by email)
  // Safer: check the programs table for contact_email
  const { data: program } = await sb
    .from('programs')
    .select('id, name, status, contact_email')
    .eq('contact_email', email.toLowerCase().trim())
    .single()

  if (program) {
    return NextResponse.json({
      exists: true,
      has_program: true,
      program_status: program.status,
      program_name: program.name,
      program_id: program.id,
    })
  }

  return NextResponse.json({ exists: false, has_program: false })
}
