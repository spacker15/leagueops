import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentEntrySchema } from '@/schemas/payments'

export async function GET(req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const teamPaymentId = searchParams.get('team_payment_id')
  let query = supabase.from('payment_entries').select('*').order('paid_at', { ascending: false })
  if (teamPaymentId) query = query.eq('team_payment_id', teamPaymentId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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
  const result = createPaymentEntrySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.flatten() }, { status: 400 })
  }

  // 4. Business logic
  const validatedBody = result.data

  // Insert the payment entry
  const { data: entry, error: entryErr } = await supabase
    .from('payment_entries')
    .insert(validatedBody)
    .select()
    .single()
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })

  // Recalculate amount_paid and status on the parent team_payment
  const { data: allEntries, error: sumErr } = await supabase
    .from('payment_entries')
    .select('amount')
    .eq('team_payment_id', validatedBody.team_payment_id)
  if (sumErr) return NextResponse.json({ error: sumErr.message }, { status: 500 })

  const totalPaid = (allEntries ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

  const { data: parent } = await supabase
    .from('team_payments')
    .select('amount_due, status')
    .eq('id', validatedBody.team_payment_id)
    .single()

  const amountDue = parent ? Number(parent.amount_due) : 0
  let newStatus: string = parent?.status ?? 'pending'
  if (validatedBody.payment_method === 'waived') {
    newStatus = 'waived'
  } else if (totalPaid <= 0) {
    newStatus = 'pending'
  } else if (totalPaid >= amountDue) {
    newStatus = 'paid'
  } else {
    newStatus = 'partial'
  }

  await supabase
    .from('team_payments')
    .update({ amount_paid: totalPaid, status: newStatus })
    .eq('id', validatedBody.team_payment_id)

  return NextResponse.json(entry, { status: 201 })
}
