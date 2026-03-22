import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const body = await req.json()
  const { data, error } = await sb.from('fields').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
