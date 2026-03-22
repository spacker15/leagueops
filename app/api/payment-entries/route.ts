import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const teamPaymentId = searchParams.get('team_payment_id')
  let query = sb.from('payment_entries').select('*').order('paid_at', { ascending: false })
  if (teamPaymentId) query = query.eq('team_payment_id', teamPaymentId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()

  // Insert the payment entry
  const { data: entry, error: entryErr } = await sb
    .from('payment_entries')
    .insert(body)
    .select()
    .single()
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })

  // Recalculate amount_paid and status on the parent team_payment
  const { data: allEntries, error: sumErr } = await sb
    .from('payment_entries')
    .select('amount')
    .eq('team_payment_id', body.team_payment_id)
  if (sumErr) return NextResponse.json({ error: sumErr.message }, { status: 500 })

  const totalPaid = (allEntries ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

  const { data: parent } = await sb
    .from('team_payments')
    .select('amount_due, status')
    .eq('id', body.team_payment_id)
    .single()

  const amountDue = parent ? Number(parent.amount_due) : 0
  let newStatus: string = parent?.status ?? 'pending'
  if (body.payment_method === 'waived') {
    newStatus = 'waived'
  } else if (totalPaid <= 0) {
    newStatus = 'pending'
  } else if (totalPaid >= amountDue) {
    newStatus = 'paid'
  } else {
    newStatus = 'partial'
  }

  await sb
    .from('team_payments')
    .update({ amount_paid: totalPaid, status: newStatus })
    .eq('id', body.team_payment_id)

  return NextResponse.json(entry, { status: 201 })
}
