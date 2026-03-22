import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { invalidateRulesCache } from '@/lib/engines/rules'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  const category = searchParams.get('category')

  let query = sb
    .from('event_rules')
    .select('*')
    .eq('event_id', eventId)
    .order('category')
    .order('rule_key')

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { id, rule_value, changed_by = 'operator', event_id } = body

  if (!id || rule_value === undefined) {
    return NextResponse.json({ error: 'id and rule_value required' }, { status: 400 })
  }

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  // Get current value for audit
  const { data: current } = await sb
    .from('event_rules')
    .select('rule_value, rule_key, category')
    .eq('id', id)
    .single()

  if (!current) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  // Update
  const { data, error } = await sb
    .from('event_rules')
    .update({
      rule_value,
      is_override: true,
      updated_at: new Date().toISOString(),
      updated_by: changed_by,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateRulesCache(Number(event_id))

  // Audit log
  await sb.from('rule_changes').insert({
    event_id,
    rule_id: id,
    rule_key: current.rule_key,
    old_value: current.rule_value,
    new_value: rule_value,
    changed_by,
    changed_at: new Date().toISOString(),
  })

  await sb.from('ops_log').insert({
    event_id,
    message: `Rule updated: ${current.category}.${current.rule_key} → "${rule_value}" (was "${current.rule_value}")`,
    log_type: 'warn',
    occurred_at: new Date().toISOString(),
  })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  // Reset to default
  const sb = createClient()
  const body = await req.json()
  const { action, id, event_id } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  if (action === 'reset_one' && id) {
    const { data: current } = await sb
      .from('event_rules')
      .select('default_value, rule_key, rule_value, category')
      .eq('id', id)
      .single()

    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await sb
      .from('event_rules')
      .update({
        rule_value: current.default_value,
        is_override: false,
        updated_at: new Date().toISOString(),
        updated_by: 'reset',
      })
      .eq('id', id)

    await sb.from('rule_changes').insert({
      event_id,
      rule_id: id,
      rule_key: current.rule_key,
      old_value: current.rule_value,
      new_value: current.default_value,
      changed_by: 'reset',
    })

    await sb.from('ops_log').insert({
      event_id,
      message: `Rule reset: ${current.category}.${current.rule_key} → "${current.default_value}"`,
      log_type: 'info',
      occurred_at: new Date().toISOString(),
    })

    invalidateRulesCache(Number(event_id))
    return NextResponse.json({ reset: true })
  }

  if (action === 'reset_all') {
    // Reset all overridden rules to defaults
    const { data: overrides } = await sb
      .from('event_rules')
      .select('id, default_value')
      .eq('event_id', event_id)
      .eq('is_override', true)

    if (overrides && overrides.length > 0) {
      for (const rule of overrides) {
        await sb
          .from('event_rules')
          .update({
            rule_value: rule.default_value,
            is_override: false,
            updated_at: new Date().toISOString(),
            updated_by: 'reset',
          })
          .eq('id', rule.id)
      }
      await sb.from('ops_log').insert({
        event_id,
        message: `All rules reset to defaults (${overrides.length} rules restored)`,
        log_type: 'info',
        occurred_at: new Date().toISOString(),
      })
      invalidateRulesCache(Number(event_id))
    }
    return NextResponse.json({ reset: overrides?.length ?? 0 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
