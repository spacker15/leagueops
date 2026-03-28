import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateVolunteerSchema } from '@/schemas/volunteers'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse raw JSON body (SEC-07)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Zod validation (SEC-07)
  const result = updateVolunteerSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.flatten() }, { status: 400 })
  }

  // 4. Business logic
  const { data, error } = await supabase
    .from('volunteers')
    .update(result.data)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
