'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Btn } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  RotateCcw, Save, Search, AlertTriangle, ChevronDown,
  ChevronRight, Clock, Zap, Thermometer, Wind, Users,
  Calendar, Settings, Info, History,
} from 'lucide-react'

interface EventRule {
  id: number
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

interface RuleChange {
  id: number
  rule_key: string
  old_value: string
  new_value: string
  changed_by: string
  changed_at: string
  rule?: { category: string; rule_label: string }
}

type Category = 'all' | 'lightning' | 'heat' | 'wind' | 'weather' | 'referee' | 'scheduling' | 'general'

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  lightning:  { label: 'Lightning',    icon: <Zap size={14} />,         color: 'text-red-400',    desc: 'Lightning delay radius, hold duration, and auto-detection' },
  heat:       { label: 'Heat',         icon: <Thermometer size={14} />, color: 'text-orange-400', desc: 'Heat index thresholds and mandatory break intervals' },
  wind:       { label: 'Wind',         icon: <Wind size={14} />,        color: 'text-yellow-400', desc: 'Wind advisory and suspension thresholds' },
  weather:    { label: 'Weather',      icon: <Clock size={14} />,       color: 'text-blue-300',   desc: 'Polling interval, caching, and weather provider settings' },
  referee:    { label: 'Referee',      icon: <Users size={14} />,       color: 'text-green-400',  desc: 'Travel buffers, max games, grade requirements per division' },
  scheduling: { label: 'Scheduling',   icon: <Calendar size={14} />,    color: 'text-purple-400', desc: 'Game duration, rest windows, start/end time constraints' },
  general:    { label: 'General',      icon: <Settings size={14} />,    color: 'text-muted',      desc: 'Tournament name, location, and app-level settings' },
}

export function RulesTab() {
  const [rules, setRules]             = useState<EventRule[]>([])
  const [changes, setChanges]         = useState<RuleChange[]>([])
  const [category, setCategory]       = useState<Category>('all')
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState<number | null>(null)
  const [editValues, setEditValues]   = useState<Record<number, string>>({})
  const [dirtyIds, setDirtyIds]       = useState<Set<number>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [expanded, setExpanded]       = useState<Set<string>>(new Set(Object.keys(CATEGORY_META)))

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rules?event_id=1')
      const data = await res.json()
      setRules(data as EventRule[])
      // Init edit values
      const ev: Record<number, string> = {}
      for (const r of data as EventRule[]) ev[r.id] = r.rule_value
      setEditValues(ev)
    } catch (e) {
      toast.error('Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadChanges = useCallback(async () => {
    try {
      const res = await fetch('/api/rules/changes?event_id=1&limit=30')
      const data = await res.json()
      setChanges(data as RuleChange[])
    } catch {}
  }, [])

  useEffect(() => { loadRules(); loadChanges() }, [loadRules, loadChanges])

  function markDirty(id: number, value: string) {
    setEditValues(prev => ({ ...prev, [id]: value }))
    const rule = rules.find(r => r.id === id)
    if (rule && value !== rule.rule_value) {
      setDirtyIds(prev => new Set([...prev, id]))
    } else {
      setDirtyIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function saveRule(id: number) {
    const value = editValues[id]
    if (value === undefined) return
    setSaving(id)
    try {
      const res = await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rule_value: value, changed_by: 'operator' }),
      })
      if (!res.ok) throw new Error('Save failed')
      await loadRules()
      await loadChanges()
      setDirtyIds(prev => { const s = new Set(prev); s.delete(id); return s })
      toast.success('Rule saved')
    } catch {
      toast.error('Failed to save rule')
    } finally {
      setSaving(null) }
  }

  async function resetRule(id: number) {
    setSaving(id)
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_one', id }),
      })
      await loadRules()
      await loadChanges()
      setDirtyIds(prev => { const s = new Set(prev); s.delete(id); return s })
      toast.success('Reset to default')
    } catch {
      toast.error('Reset failed')
    } finally { setSaving(null) }
  }

  async function resetAll() {
    if (!confirm('Reset ALL overridden rules to their defaults? This cannot be undone.')) return
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_all', event_id: 1 }),
    })
    const data = await res.json()
    await loadRules()
    await loadChanges()
    setDirtyIds(new Set())
    toast.success(`${data.reset} rules reset to defaults`)
  }

  async function saveAllDirty() {
    const ids = [...dirtyIds]
    for (const id of ids) await saveRule(id)
    toast.success(`${ids.length} rules saved`)
  }

  // ── Filter ───────────────────────────────────────────────
  const filtered = rules.filter(r => {
    if (category !== 'all' && r.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.rule_label.toLowerCase().includes(q) ||
        r.rule_key.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  // Group by category
  const grouped = filtered.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = []
    acc[rule.category].push(rule)
    return acc
  }, {} as Record<string, EventRule[]>)

  const overrideCount = rules.filter(r => r.is_override).length
  const dirtyCount    = dirtyIds.size

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-cond text-muted text-sm tracking-widest">LOADING RULES...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rules..."
            className="w-full bg-surface-card border border-border text-white pl-7 pr-3 py-1.5 rounded text-[12px] outline-none focus:border-blue-400 font-sans"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1">
          {(['all', ...Object.keys(CATEGORY_META)] as Category[]).map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn(
                'font-cond text-[10px] font-bold tracking-wider px-2.5 py-1 rounded transition-colors',
                category === cat
                  ? 'bg-navy text-white'
                  : 'bg-surface-card border border-border text-muted hover:text-white'
              )}>
              {cat === 'all' ? `ALL (${rules.length})` : CATEGORY_META[cat]?.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {overrideCount > 0 && (
            <span className="font-cond text-[10px] font-bold text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 px-2 py-1 rounded">
              {overrideCount} OVERRIDE{overrideCount > 1 ? 'S' : ''} ACTIVE
            </span>
          )}
          {dirtyCount > 0 && (
            <Btn variant="success" size="sm" onClick={saveAllDirty}>
              <Save size={11} className="inline mr-1" />
              SAVE {dirtyCount} CHANGE{dirtyCount > 1 ? 'S' : ''}
            </Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={() => setShowHistory(h => !h)}>
            <History size={11} className="inline mr-1" />
            HISTORY
          </Btn>
          {overrideCount > 0 && (
            <Btn variant="danger" size="sm" onClick={resetAll}>
              <RotateCcw size={11} className="inline mr-1" />
              RESET ALL
            </Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Left: rule groups */}
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, catRules]) => {
            const meta   = CATEGORY_META[cat]
            const isOpen = expanded.has(cat)
            const overrides = catRules.filter(r => r.is_override).length
            const dirty     = catRules.filter(r => dirtyIds.has(r.id)).length

            return (
              <div key={cat} className="bg-surface-card border border-border rounded-lg overflow-hidden">
                {/* Category header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 bg-navy/60 hover:bg-navy/80 transition-colors text-left"
                  onClick={() => setExpanded(prev => {
                    const s = new Set(prev)
                    if (s.has(cat)) s.delete(cat); else s.add(cat)
                    return s
                  })}
                >
                  <span className={cn('shrink-0', meta?.color ?? 'text-muted')}>{meta?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-cond font-black text-[13px] text-white tracking-wide">
                      {meta?.label ?? cat.toUpperCase()}
                    </div>
                    <div className="font-cond text-[10px] text-muted truncate">{meta?.desc}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {overrides > 0 && (
                      <span className="font-cond text-[9px] font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">
                        {overrides} OVERRIDE{overrides > 1 ? 'S' : ''}
                      </span>
                    )}
                    {dirty > 0 && (
                      <span className="font-cond text-[9px] font-bold text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
                        {dirty} UNSAVED
                      </span>
                    )}
                    <span className="text-muted">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                  </div>
                </button>

                {/* Rules */}
                {isOpen && (
                  <div className="divide-y divide-border/50">
                    {catRules.map(rule => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        editValue={editValues[rule.id] ?? rule.rule_value}
                        isDirty={dirtyIds.has(rule.id)}
                        isSaving={saving === rule.id}
                        onChange={val => markDirty(rule.id, val)}
                        onSave={() => saveRule(rule.id)}
                        onReset={() => resetRule(rule.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-16 text-muted font-cond font-bold tracking-widest">
              NO RULES MATCH YOUR FILTER
            </div>
          )}
        </div>

        {/* Right: history + summary */}
        <div className="space-y-4">
          {/* Override summary */}
          <div className="bg-surface-card border border-border rounded-lg p-4">
            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">RULE SUMMARY</div>
            <div className="space-y-2">
              <StatRow label="Total Rules" value={rules.length} color="text-white" />
              <StatRow label="Overrides Active" value={overrideCount} color={overrideCount > 0 ? 'text-yellow-400' : 'text-green-400'} />
              <StatRow label="Using Defaults" value={rules.length - overrideCount} color="text-green-400" />
              <StatRow label="Unsaved Changes" value={dirtyCount} color={dirtyCount > 0 ? 'text-orange-400' : 'text-muted'} />
            </div>

            {overrideCount > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="font-cond text-[10px] font-bold text-muted uppercase mb-2">ACTIVE OVERRIDES</div>
                <div className="space-y-1">
                  {rules.filter(r => r.is_override).map(r => (
                    <div key={r.id} className="flex justify-between text-[10px]">
                      <span className="font-cond text-yellow-400 truncate flex-1 mr-2">{r.rule_label}</span>
                      <span className="font-mono text-white shrink-0">{r.rule_value}{r.unit ? ` ${r.unit}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Change history */}
          <div className="bg-surface-card border border-border rounded-lg p-4">
            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3 flex justify-between">
              <span>CHANGE HISTORY</span>
              <button onClick={loadChanges} className="text-blue-300 hover:text-white"><RotateCcw size={11} /></button>
            </div>
            {changes.length === 0 ? (
              <div className="text-[11px] text-muted font-cond text-center py-4">No changes yet</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {changes.map(c => (
                  <div key={c.id} className="text-[10px] border-b border-border/40 pb-2">
                    <div className="font-cond font-bold text-[11px] text-white mb-0.5">
                      {c.rule?.rule_label ?? c.rule_key}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-red-400 line-through">{c.old_value}</span>
                      <span className="text-muted">→</span>
                      <span className="text-green-400">{c.new_value}</span>
                    </div>
                    <div className="text-muted mt-0.5 font-cond">
                      {c.changed_by} · {new Date(c.changed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick override panel */}
          <div className="bg-surface-card border border-border rounded-lg p-4">
            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
              QUICK OVERRIDES
            </div>
            <div className="space-y-2">
              {[
                { label: 'Tighten Lightning (6mi)', key: 'lightning.radius_miles', value: '6' },
                { label: 'Extreme heat day (90°F advisory)', key: 'heat.advisory_f', value: '90' },
                { label: 'Young refs OK (no grade req)', key: 'referee.refs_per_game', value: '1' },
                { label: 'Shorter games (50 min)', key: 'scheduling.game_duration_min', value: '50' },
              ].map(preset => (
                <button
                  key={preset.key}
                  onClick={async () => {
                    const [cat, rkey] = preset.key.split('.')
                    const rule = rules.find(r => r.category === cat && r.rule_key === rkey)
                    if (!rule) { toast.error(`Rule ${preset.key} not found`); return }
                    markDirty(rule.id, preset.value)
                    await fetch('/api/rules', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: rule.id, rule_value: preset.value }),
                    })
                    await loadRules()
                    await loadChanges()
                    setDirtyIds(prev => { const s = new Set(prev); s.delete(rule.id); return s })
                    toast.success(`Quick override: ${preset.label}`)
                  }}
                  className="w-full text-left font-cond text-[11px] font-bold text-blue-300 bg-navy/40 hover:bg-navy px-3 py-2 rounded border border-border hover:border-blue-400 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Single rule row ─────────────────────────────────────────
function RuleRow({ rule, editValue, isDirty, isSaving, onChange, onSave, onReset }: {
  rule: EventRule
  editValue: string
  isDirty: boolean
  isSaving: boolean
  onChange: (v: string) => void
  onSave: () => void
  onReset: () => void
}) {
  const [showDesc, setShowDesc] = useState(false)
  const isDefault = editValue === rule.default_value

  return (
    <div className={cn(
      'px-4 py-3 flex items-start gap-4 transition-colors',
      isDirty   ? 'bg-orange-900/10' :
      rule.is_override ? 'bg-yellow-900/8' : 'hover:bg-white/5'
    )}>
      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-cond font-black text-[12px] text-white">{rule.rule_label}</span>
          {rule.is_override && !isDirty && (
            <span className="font-cond text-[9px] font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">OVERRIDE</span>
          )}
          {isDirty && (
            <span className="font-cond text-[9px] font-bold text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded">UNSAVED</span>
          )}
          {rule.description && (
            <button onClick={() => setShowDesc(s => !s)} className="text-muted hover:text-white transition-colors">
              <Info size={11} />
            </button>
          )}
        </div>
        {showDesc && rule.description && (
          <div className="text-[10px] text-muted font-sans mb-1 leading-relaxed">{rule.description}</div>
        )}
        {!isDefault && !isDirty && (
          <div className="font-cond text-[9px] text-muted">
            Default: <span className="font-mono text-muted/70">{rule.default_value}{rule.unit ? ` ${rule.unit}` : ''}</span>
          </div>
        )}
        {rule.unit && (
          <div className="font-cond text-[9px] text-muted/60 mt-0.5">{rule.unit}</div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 shrink-0">
        {rule.value_type === 'boolean' ? (
          <button
            onClick={() => onChange(editValue === 'true' ? 'false' : 'true')}
            className={cn(
              'relative w-10 h-5 rounded-full border-2 transition-all',
              editValue === 'true'
                ? 'bg-green-600 border-green-500'
                : 'bg-gray-700 border-gray-600'
            )}
          >
            <span className={cn(
              'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all',
              editValue === 'true' ? 'left-5' : 'left-0.5'
            )} />
          </button>
        ) : rule.value_type === 'select' ? (
          <select
            value={editValue}
            onChange={e => onChange(e.target.value)}
            className="bg-surface border border-border text-white px-2 py-1 rounded text-[12px] font-mono outline-none focus:border-blue-400 w-36"
          >
            {(rule.options ?? []).map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : rule.value_type === 'number' ? (
          <input
            type="number"
            value={editValue}
            onChange={e => onChange(e.target.value)}
            step={editValue.includes('.') ? '0.1' : '1'}
            className={cn(
              'bg-surface border text-white px-2 py-1 rounded text-[13px] font-mono outline-none focus:border-blue-400 w-20 text-center',
              isDirty ? 'border-orange-500' : rule.is_override ? 'border-yellow-700' : 'border-border'
            )}
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={e => onChange(e.target.value)}
            className={cn(
              'bg-surface border text-white px-2 py-1 rounded text-[12px] font-mono outline-none focus:border-blue-400 w-48',
              isDirty ? 'border-orange-500' : rule.is_override ? 'border-yellow-700' : 'border-border'
            )}
          />
        )}

        {/* Save button — shows when dirty */}
        {(isDirty || rule.value_type === 'boolean') && (
          <button
            onClick={rule.value_type === 'boolean' ? onSave : onSave}
            disabled={isSaving || !isDirty}
            className={cn(
              'font-cond text-[10px] font-bold tracking-wider px-2 py-1 rounded transition-colors',
              isDirty
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-surface-card border border-border text-muted cursor-default'
            )}
          >
            {isSaving ? '...' : <Save size={11} />}
          </button>
        )}

        {/* Reset to default */}
        {(rule.is_override || isDirty) && (
          <button
            onClick={onReset}
            disabled={isSaving}
            title={`Reset to default: ${rule.default_value}`}
            className="text-muted hover:text-red-400 transition-colors"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-muted font-cond">{label}</span>
      <span className={cn('font-mono font-bold', color)}>{value}</span>
    </div>
  )
}
