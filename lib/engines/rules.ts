/**
 * LeagueOps — Rules Engine
 *
 * Loads event rules from the database and provides typed accessors.
 * All engine code calls getRules() instead of using hardcoded constants.
 *
 * Rules are cached in memory per event to avoid redundant DB calls.
 * Call invalidateRulesCache(eventId) after any rule change.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Per-event cache: keyed by eventId → { map, time }
const _cacheByEvent = new Map<number, { map: Record<string, string>; time: number }>()
const CACHE_TTL_MS = 30_000 // 30s

export interface EventRule {
  id: number
  event_id: number
  category: string
  rule_key: string
  rule_label: string
  rule_value: string
  value_type: 'number' | 'boolean' | 'text' | 'select'
  unit: string | null
  description: string | null
  options: string[] | null
  is_override: boolean
  default_value: string
  updated_at: string
  updated_by: string
}

// ─── Load all rules for event ─────────────────────────────────
export async function loadRules(eventId: number, sb: SupabaseClient): Promise<EventRule[]> {
  const { data } = await sb
    .from('event_rules')
    .select('*')
    .eq('event_id', eventId)
    .order('category')
    .order('rule_key')
  return (data as EventRule[]) ?? []
}

// ─── Get flat key→value map (cached per event) ────────────────
export async function getRules(
  eventId: number,
  sb: SupabaseClient
): Promise<Record<string, string>> {
  const now = Date.now()
  const cached = _cacheByEvent.get(eventId)
  if (cached && now - cached.time < CACHE_TTL_MS) return cached.map

  const rules = await loadRules(eventId, sb)
  const map: Record<string, string> = {}
  for (const r of rules) {
    map[`${r.category}.${r.rule_key}`] = r.rule_value
  }
  _cacheByEvent.set(eventId, { map, time: now })
  return map
}

export function invalidateRulesCache(eventId?: number) {
  if (eventId !== undefined) _cacheByEvent.delete(eventId)
  else _cacheByEvent.clear()
}

// ─── Typed getters ────────────────────────────────────────────
export async function getRule(
  eventId: number,
  category: string,
  key: string,
  fallback: string,
  sb: SupabaseClient
): Promise<string> {
  const rules = await getRules(eventId, sb)
  return rules[`${category}.${key}`] ?? fallback
}

export async function getRuleNum(
  eventId: number,
  category: string,
  key: string,
  fallback: number,
  sb: SupabaseClient
): Promise<number> {
  const v = await getRule(eventId, category, key, String(fallback), sb)
  const n = parseFloat(v)
  return isNaN(n) ? fallback : n
}

export async function getRuleBool(
  eventId: number,
  category: string,
  key: string,
  fallback: boolean,
  sb: SupabaseClient
): Promise<boolean> {
  const v = await getRule(eventId, category, key, String(fallback), sb)
  return v === 'true' || v === '1'
}

// ─── Convenience: get all thresholds for an engine ───────────
export async function getWeatherThresholds(eventId: number, sb: SupabaseClient) {
  const rules = await getRules(eventId, sb)
  return {
    lightning: {
      radius_miles: parseFloat(rules['lightning.radius_miles'] ?? '8'),
      delay_minutes: parseFloat(rules['lightning.delay_minutes'] ?? '30'),
      reset_on_new_strike: rules['lightning.reset_on_new_strike'] !== 'false',
      auto_detect: rules['lightning.auto_detect'] !== 'false',
    },
    heat: {
      advisory_f: parseFloat(rules['heat.advisory_f'] ?? '95'),
      warning_f: parseFloat(rules['heat.warning_f'] ?? '103'),
      emergency_f: parseFloat(rules['heat.emergency_f'] ?? '113'),
      advisory_break_min: parseFloat(rules['heat.advisory_break_min'] ?? '30'),
      warning_break_min: parseFloat(rules['heat.warning_break_min'] ?? '20'),
      use_heat_index: rules['heat.use_heat_index'] !== 'false',
    },
    wind: {
      advisory_mph: parseFloat(rules['wind.advisory_mph'] ?? '25'),
      suspend_mph: parseFloat(rules['wind.suspend_mph'] ?? '40'),
      gust_factor: parseFloat(rules['wind.gust_factor'] ?? '50'),
    },
    poll_interval_min: parseFloat(rules['weather.poll_interval_min'] ?? '5'),
  }
}

export async function getRefereeRules(eventId: number, sb: SupabaseClient) {
  const rules = await getRules(eventId, sb)
  return {
    travel_buffer_min: parseFloat(rules['referee.travel_buffer_min'] ?? '30'),
    max_games_per_day: parseFloat(rules['referee.max_games_per_day'] ?? '4'),
    refs_per_game: parseFloat(rules['referee.refs_per_game'] ?? '2'),
    require_checkin: rules['referee.require_checkin'] === 'true',
    min_grade: {
      U12: parseFloat(rules['referee.min_grade_u12'] ?? '5'),
      U14: parseFloat(rules['referee.min_grade_u14'] ?? '6'),
      U16: parseFloat(rules['referee.min_grade_u16'] ?? '7'),
    },
  }
}

export async function getSchedulingRules(eventId: number, sb: SupabaseClient) {
  const rules = await getRules(eventId, sb)
  return {
    game_duration_min: parseFloat(rules['scheduling.game_duration_min'] ?? '60'),
    buffer_min: parseFloat(rules['scheduling.buffer_min'] ?? '10'),
    min_rest_min: parseFloat(rules['scheduling.min_rest_min'] ?? '90'),
    earliest_start: rules['scheduling.earliest_start'] ?? '08:00',
    latest_end: rules['scheduling.latest_end'] ?? '18:00',
    allow_doubleheaders: rules['scheduling.allow_doubleheaders'] !== 'false',
  }
}

// ─── Update a single rule ─────────────────────────────────────
export async function updateRule(
  id: number,
  newValue: string,
  changedBy = 'operator',
  eventId: number,
  sb: SupabaseClient
): Promise<void> {
  // Get current value for audit log
  const { data: current } = await sb
    .from('event_rules')
    .select('rule_value, rule_key')
    .eq('id', id)
    .single()

  if (!current) return

  // Update rule
  await sb
    .from('event_rules')
    .update({
      rule_value: newValue,
      is_override: true,
      updated_at: new Date().toISOString(),
      updated_by: changedBy,
    })
    .eq('id', id)

  // Write to change log
  await sb.from('rule_changes').insert({
    event_id: eventId,
    rule_id: id,
    rule_key: current.rule_key,
    old_value: current.rule_value,
    new_value: newValue,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
  })

  // Write to ops log
  await sb.from('ops_log').insert({
    event_id: eventId,
    message: `Rule updated: ${current.rule_key} → ${newValue} (was: ${current.rule_value})`,
    log_type: 'warn',
    occurred_at: new Date().toISOString(),
  })

  invalidateRulesCache(eventId)
}

// ─── Reset a rule to default ──────────────────────────────────
export async function resetRule(id: number, eventId: number, sb: SupabaseClient): Promise<void> {
  const { data: current } = await sb
    .from('event_rules')
    .select('default_value, rule_key, rule_value')
    .eq('id', id)
    .single()

  if (!current) return

  await sb
    .from('event_rules')
    .update({
      rule_value: current.default_value,
      is_override: false,
      updated_at: new Date().toISOString(),
      updated_by: 'system',
    })
    .eq('id', id)

  await sb.from('rule_changes').insert({
    event_id: eventId,
    rule_id: id,
    rule_key: current.rule_key,
    old_value: current.rule_value,
    new_value: current.default_value,
    changed_by: 'reset',
    changed_at: new Date().toISOString(),
  })

  await sb.from('ops_log').insert({
    event_id: eventId,
    message: `Rule reset to default: ${current.rule_key} → ${current.default_value}`,
    log_type: 'info',
    occurred_at: new Date().toISOString(),
  })

  invalidateRulesCache(eventId)
}

// ─── Reset ALL rules to defaults ─────────────────────────────
export async function resetAllRules(eventId: number, sb: SupabaseClient): Promise<void> {
  const { data: overrides } = await sb
    .from('event_rules')
    .select('id, default_value')
    .eq('event_id', eventId)
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
  }

  invalidateRulesCache(eventId)
}
