/**
 * LeagueOps — Rules Engine
 *
 * Loads event rules from the database and provides typed accessors.
 * All engine code calls getRules() instead of using hardcoded constants.
 *
 * Rules are cached in memory per session to avoid redundant DB calls.
 * Call invalidateRulesCache() after any rule change.
 */

import { createClient } from '@/supabase/client'

const EVENT_ID = 1

// ─── In-memory cache ──────────────────────────────────────────
let _cache: Record<string, string> | null = null
let _cacheTime = 0
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
export async function loadRules(eventId = EVENT_ID): Promise<EventRule[]> {
  const sb = createClient()
  const { data } = await sb
    .from('event_rules')
    .select('*')
    .eq('event_id', eventId)
    .order('category')
    .order('rule_key')
  return (data as EventRule[]) ?? []
}

// ─── Get flat key→value map (cached) ─────────────────────────
export async function getRules(eventId = EVENT_ID): Promise<Record<string, string>> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache

  const rules = await loadRules(eventId)
  const map: Record<string, string> = {}
  for (const r of rules) {
    map[`${r.category}.${r.rule_key}`] = r.rule_value
  }
  _cache = map
  _cacheTime = now
  return map
}

export function invalidateRulesCache() {
  _cache = null
  _cacheTime = 0
}

// ─── Typed getters ────────────────────────────────────────────
export async function getRule(category: string, key: string, fallback: string): Promise<string> {
  const rules = await getRules()
  return rules[`${category}.${key}`] ?? fallback
}

export async function getRuleNum(category: string, key: string, fallback: number): Promise<number> {
  const v = await getRule(category, key, String(fallback))
  const n = parseFloat(v)
  return isNaN(n) ? fallback : n
}

export async function getRuleBool(category: string, key: string, fallback: boolean): Promise<boolean> {
  const v = await getRule(category, key, String(fallback))
  return v === 'true' || v === '1'
}

// ─── Convenience: get all thresholds for an engine ───────────
export async function getWeatherThresholds() {
  const rules = await getRules()
  return {
    lightning: {
      radius_miles:       parseFloat(rules['lightning.radius_miles']        ?? '8'),
      delay_minutes:      parseFloat(rules['lightning.delay_minutes']       ?? '30'),
      reset_on_new_strike: rules['lightning.reset_on_new_strike']           !== 'false',
      auto_detect:        rules['lightning.auto_detect']                    !== 'false',
    },
    heat: {
      advisory_f:         parseFloat(rules['heat.advisory_f']               ?? '95'),
      warning_f:          parseFloat(rules['heat.warning_f']                ?? '103'),
      emergency_f:        parseFloat(rules['heat.emergency_f']              ?? '113'),
      advisory_break_min: parseFloat(rules['heat.advisory_break_min']       ?? '30'),
      warning_break_min:  parseFloat(rules['heat.warning_break_min']        ?? '20'),
      use_heat_index:     rules['heat.use_heat_index']                      !== 'false',
    },
    wind: {
      advisory_mph:       parseFloat(rules['wind.advisory_mph']             ?? '25'),
      suspend_mph:        parseFloat(rules['wind.suspend_mph']              ?? '40'),
      gust_factor:        parseFloat(rules['wind.gust_factor']              ?? '50'),
    },
    poll_interval_min:    parseFloat(rules['weather.poll_interval_min']     ?? '5'),
  }
}

export async function getRefereeRules() {
  const rules = await getRules()
  return {
    travel_buffer_min:   parseFloat(rules['referee.travel_buffer_min']      ?? '30'),
    max_games_per_day:   parseFloat(rules['referee.max_games_per_day']      ?? '4'),
    refs_per_game:       parseFloat(rules['referee.refs_per_game']          ?? '2'),
    require_checkin:     rules['referee.require_checkin']                   === 'true',
    min_grade: {
      U12: parseFloat(rules['referee.min_grade_u12']                        ?? '5'),
      U14: parseFloat(rules['referee.min_grade_u14']                        ?? '6'),
      U16: parseFloat(rules['referee.min_grade_u16']                        ?? '7'),
    },
  }
}

export async function getSchedulingRules() {
  const rules = await getRules()
  return {
    game_duration_min:   parseFloat(rules['scheduling.game_duration_min']   ?? '60'),
    buffer_min:          parseFloat(rules['scheduling.buffer_min']          ?? '10'),
    min_rest_min:        parseFloat(rules['scheduling.min_rest_min']        ?? '90'),
    earliest_start:      rules['scheduling.earliest_start']                 ?? '08:00',
    latest_end:          rules['scheduling.latest_end']                     ?? '18:00',
    allow_doubleheaders: rules['scheduling.allow_doubleheaders']            !== 'false',
  }
}

// ─── Update a single rule ─────────────────────────────────────
export async function updateRule(
  id: number,
  newValue: string,
  changedBy = 'operator'
): Promise<void> {
  const sb = createClient()

  // Get current value for audit log
  const { data: current } = await sb
    .from('event_rules')
    .select('rule_value, rule_key')
    .eq('id', id)
    .single()

  if (!current) return

  // Update rule
  await sb.from('event_rules').update({
    rule_value:   newValue,
    is_override:  true,
    updated_at:   new Date().toISOString(),
    updated_by:   changedBy,
  }).eq('id', id)

  // Write to change log
  await sb.from('rule_changes').insert({
    event_id:   EVENT_ID,
    rule_id:    id,
    rule_key:   current.rule_key,
    old_value:  current.rule_value,
    new_value:  newValue,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
  })

  // Write to ops log
  await sb.from('ops_log').insert({
    event_id:    EVENT_ID,
    message:     `Rule updated: ${current.rule_key} → ${newValue} (was: ${current.rule_value})`,
    log_type:    'warn',
    occurred_at: new Date().toISOString(),
  })

  invalidateRulesCache()
}

// ─── Reset a rule to default ──────────────────────────────────
export async function resetRule(id: number): Promise<void> {
  const sb = createClient()
  const { data: current } = await sb
    .from('event_rules')
    .select('default_value, rule_key, rule_value')
    .eq('id', id)
    .single()

  if (!current) return

  await sb.from('event_rules').update({
    rule_value:   current.default_value,
    is_override:  false,
    updated_at:   new Date().toISOString(),
    updated_by:   'system',
  }).eq('id', id)

  await sb.from('rule_changes').insert({
    event_id:   EVENT_ID,
    rule_id:    id,
    rule_key:   current.rule_key,
    old_value:  current.rule_value,
    new_value:  current.default_value,
    changed_by: 'reset',
    changed_at: new Date().toISOString(),
  })

  await sb.from('ops_log').insert({
    event_id:    EVENT_ID,
    message:     `Rule reset to default: ${current.rule_key} → ${current.default_value}`,
    log_type:    'info',
    occurred_at: new Date().toISOString(),
  })

  invalidateRulesCache()
}

// ─── Reset ALL rules to defaults ─────────────────────────────
export async function resetAllRules(eventId = EVENT_ID): Promise<void> {
  const sb = createClient()
  const { data: overrides } = await sb
    .from('event_rules')
    .select('id, default_value')
    .eq('event_id', eventId)
    .eq('is_override', true)

  if (overrides && overrides.length > 0) {
    for (const rule of overrides) {
      await sb.from('event_rules').update({
        rule_value:  rule.default_value,
        is_override: false,
        updated_at:  new Date().toISOString(),
        updated_by:  'reset',
      }).eq('id', rule.id)
    }
  }

  invalidateRulesCache()
}
