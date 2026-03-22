import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { generateShiftHandoff } from '@/lib/engines/unified'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { created_by } = body

    if (!created_by || typeof created_by !== 'string') {
      return NextResponse.json(
        { error: 'created_by is required and must be a string' },
        { status: 400 }
      )
    }

    const sb = createClient()
    const result = await generateShiftHandoff(created_by, sb)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
