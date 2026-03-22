'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/supabase/client'
import { Btn, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Trash2, GripVertical, Eye, EyeOff, RefreshCw } from 'lucide-react'

interface Division {
  id: number
  name: string
  age_group: string | null
  gender: string | null
  sort_order: number
  is_active: boolean
  max_teams: number | null
}

interface Question {
  id: number
  section: string
  question_key: string
  question_text: string
  question_type: string
  placeholder: string | null
  options: string[] | null
  is_required: boolean
  is_active: boolean
  sort_order: number
}

const QUESTION_TYPES = ['text', 'textarea', 'select', 'checkbox', 'number', 'phone', 'email']
const SECTIONS = ['program', 'team', 'coach']

export function RegistrationConfig() {
  const [divisions, setDivisions] = useState<Division[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [activeTab, setActiveTab] = useState<'divisions' | 'questions'>('divisions')
  const [loading, setLoading] = useState(true)

  // New division form
  const [newDivName, setNewDivName] = useState('')
  const [newDivAge, setNewDivAge] = useState('')
  const [newDivGender, setNewDivGender] = useState('Boys')
  const [newMaxTeams, setNewMaxTeams] = useState('')

  // New question form
  const [newQSection, setNewQSection] = useState('team')
  const [newQText, setNewQText] = useState('')
  const [newQKey, setNewQKey] = useState('')
  const [newQType, setNewQType] = useState('text')
  const [newQPlaceholder, setNewQPlaceholder] = useState('')
  const [newQRequired, setNewQRequired] = useState(false)
  const [newQOptions, setNewQOptions] = useState('') // comma-separated

  const load = useCallback(async () => {
    const sb = createClient()
    setLoading(true)
    const [{ data: divs }, { data: qs }] = await Promise.all([
      sb.from('registration_divisions').select('*').eq('event_id', 1).order('sort_order'),
      sb
        .from('registration_questions')
        .select('*')
        .eq('event_id', 1)
        .order('section')
        .order('sort_order'),
    ])
    setDivisions((divs as Division[]) ?? [])
    setQuestions((qs as Question[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Auto-generate key from text
  function textToKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }

  async function addDivision() {
    if (!newDivName) {
      toast.error('Division name required')
      return
    }
    const sb = createClient()
    const nextOrder = Math.max(0, ...divisions.map((d) => d.sort_order)) + 1
    const { error } = await sb.from('registration_divisions').insert({
      event_id: 1,
      name: newDivName,
      age_group: newDivAge || null,
      gender: newDivGender || null,
      sort_order: nextOrder,
      is_active: true,
      max_teams: newMaxTeams ? Number(newMaxTeams) : null,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Division "${newDivName}" added`)
    setNewDivName('')
    setNewDivAge('')
    setNewMaxTeams('')
    load()
  }

  async function toggleDivision(id: number, current: boolean) {
    const sb = createClient()
    await sb.from('registration_divisions').update({ is_active: !current }).eq('id', id)
    setDivisions((prev) => prev.map((d) => (d.id === id ? { ...d, is_active: !current } : d)))
    toast.success(current ? 'Division hidden from registration' : 'Division shown on registration')
  }

  async function deleteDivision(id: number, name: string) {
    if (!confirm(`Remove division "${name}"? This will not affect already-registered teams.`))
      return
    const sb = createClient()
    await sb.from('registration_divisions').delete().eq('id', id)
    setDivisions((prev) => prev.filter((d) => d.id !== id))
    toast.success(`"${name}" removed`)
  }

  async function updateDivMaxTeams(id: number, val: string) {
    const sb = createClient()
    const max = val ? Number(val) : null
    await sb.from('registration_divisions').update({ max_teams: max }).eq('id', id)
    setDivisions((prev) => prev.map((d) => (d.id === id ? { ...d, max_teams: max } : d)))
    toast.success('Max teams updated')
  }

  async function addQuestion() {
    if (!newQText) {
      toast.error('Question text required')
      return
    }
    const key = newQKey || textToKey(newQText)
    const sb = createClient()
    const nextOrder =
      Math.max(0, ...questions.filter((q) => q.section === newQSection).map((q) => q.sort_order)) +
      1
    const options =
      newQType === 'select' && newQOptions
        ? newQOptions
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : null
    const { error } = await sb.from('registration_questions').insert({
      event_id: 1,
      section: newQSection,
      question_key: key,
      question_text: newQText,
      question_type: newQType,
      placeholder: newQPlaceholder || null,
      options,
      is_required: newQRequired,
      is_active: true,
      sort_order: nextOrder,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Question added')
    setNewQText('')
    setNewQKey('')
    setNewQPlaceholder('')
    setNewQOptions('')
    setNewQRequired(false)
    load()
  }

  async function toggleQuestion(id: number, current: boolean) {
    const sb = createClient()
    await sb.from('registration_questions').update({ is_active: !current }).eq('id', id)
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: !current } : q)))
    toast.success(current ? 'Question hidden' : 'Question shown')
  }

  async function toggleRequired(id: number, current: boolean) {
    const sb = createClient()
    await sb.from('registration_questions').update({ is_required: !current }).eq('id', id)
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_required: !current } : q)))
  }

  async function deleteQuestion(id: number, text: string) {
    if (!confirm(`Remove question "${text}"?`)) return
    const sb = createClient()
    await sb.from('registration_questions').delete().eq('id', id)
    setQuestions((prev) => prev.filter((q) => q.id !== id))
    toast.success('Question removed')
  }

  const SECTION_LABELS: Record<string, string> = {
    program: 'Program Info Page',
    team: 'Team Info (per team)',
    coach: 'Coach Info (per team)',
  }
  const SECTION_COLORS: Record<string, string> = {
    program: 'text-purple-400 bg-purple-900/30',
    team: 'text-blue-300 bg-blue-900/30',
    coach: 'text-green-400 bg-green-900/30',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionHeader>REGISTRATION CONFIGURATION</SectionHeader>
        <Btn size="sm" variant="ghost" onClick={load}>
          <RefreshCw size={11} className="inline mr-1" /> REFRESH
        </Btn>
      </div>

      <div className="text-[11px] text-muted font-cond mb-4 leading-relaxed">
        Configure what appears on the public registration form. Changes take effect immediately for
        new registrations.
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2 mb-5">
        {(['divisions', 'questions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
              activeTab === t
                ? 'bg-navy border-blue-400 text-white'
                : 'bg-surface-card border-border text-muted hover:text-white'
            )}
          >
            {t === 'divisions'
              ? `Divisions (${divisions.length})`
              : `Questions (${questions.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted font-cond">LOADING...</div>
      ) : (
        <>
          {/* ── DIVISIONS ── */}
          {activeTab === 'divisions' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Add form */}
              <div className="bg-surface-card border border-border rounded-xl p-4">
                <div className="font-cond font-black text-[13px] tracking-wide mb-4">
                  ADD DIVISION
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                      Division Name *
                    </label>
                    <input
                      className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                      value={newDivName}
                      onChange={(e) => setNewDivName(e.target.value)}
                      placeholder="e.g. 14U Boys"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                        Age Group
                      </label>
                      <input
                        className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                        value={newDivAge}
                        onChange={(e) => setNewDivAge(e.target.value)}
                        placeholder="e.g. 14U"
                      />
                    </div>
                    <div>
                      <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                        Gender
                      </label>
                      <select
                        className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                        value={newDivGender}
                        onChange={(e) => setNewDivGender(e.target.value)}
                      >
                        <option>Boys</option>
                        <option>Girls</option>
                        <option>Co-Ed</option>
                        <option>Open</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                      Max Teams (blank = unlimited)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                      value={newMaxTeams}
                      onChange={(e) => setNewMaxTeams(e.target.value)}
                      placeholder="Leave blank for unlimited"
                      min="1"
                    />
                  </div>
                  <Btn variant="primary" className="w-full" onClick={addDivision}>
                    <Plus size={12} className="inline mr-1" /> ADD DIVISION
                  </Btn>
                </div>
              </div>

              {/* Division list */}
              <div>
                <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase mb-3">
                  CURRENT DIVISIONS ({divisions.filter((d) => d.is_active).length} active)
                </div>
                <div className="space-y-2">
                  {divisions.map((div) => (
                    <div
                      key={div.id}
                      className={cn(
                        'flex items-center gap-3 bg-surface-card border rounded-lg px-3 py-2.5',
                        div.is_active ? 'border-border' : 'border-border/40 opacity-60'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-cond font-bold text-[13px] text-white">{div.name}</div>
                        <div className="font-cond text-[10px] text-muted">
                          {[div.age_group, div.gender].filter(Boolean).join(' · ')}
                          {div.max_teams && ` · Max ${div.max_teams} teams`}
                        </div>
                      </div>
                      {/* Inline max teams edit */}
                      <input
                        type="number"
                        placeholder="Max"
                        min="1"
                        defaultValue={div.max_teams ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== String(div.max_teams ?? ''))
                            updateDivMaxTeams(div.id, e.target.value)
                        }}
                        className="bg-surface border border-border text-white px-2 py-1 rounded text-[11px] w-16 outline-none focus:border-blue-400"
                        title="Max teams"
                      />
                      <button
                        onClick={() => toggleDivision(div.id, div.is_active)}
                        title={div.is_active ? 'Hide from registration' : 'Show on registration'}
                        className="text-muted hover:text-white transition-colors"
                      >
                        {div.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={() => deleteDivision(div.id, div.name)}
                        className="text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── QUESTIONS ── */}
          {activeTab === 'questions' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Add form */}
              <div className="bg-surface-card border border-border rounded-xl p-4">
                <div className="font-cond font-black text-[13px] tracking-wide mb-4">
                  ADD QUESTION
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                      Appears On
                    </label>
                    <select
                      className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                      value={newQSection}
                      onChange={(e) => setNewQSection(e.target.value)}
                    >
                      {SECTIONS.map((s) => (
                        <option key={s} value={s}>
                          {SECTION_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                      Question Text *
                    </label>
                    <input
                      className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                      value={newQText}
                      onChange={(e) => {
                        setNewQText(e.target.value)
                        setNewQKey(textToKey(e.target.value))
                      }}
                      placeholder="e.g. Jersey color"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                        Field Type
                      </label>
                      <select
                        className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                        value={newQType}
                        onChange={(e) => setNewQType(e.target.value)}
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                        Placeholder
                      </label>
                      <input
                        className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                        value={newQPlaceholder}
                        onChange={(e) => setNewQPlaceholder(e.target.value)}
                        placeholder="e.g. Navy Blue"
                      />
                    </div>
                  </div>
                  {newQType === 'select' && (
                    <div>
                      <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1">
                        Options (comma-separated)
                      </label>
                      <input
                        className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[13px] outline-none focus:border-blue-400"
                        value={newQOptions}
                        onChange={(e) => setNewQOptions(e.target.value)}
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNewQRequired((r) => !r)}
                      className={cn(
                        'relative w-9 h-5 rounded-full border-2 transition-all',
                        newQRequired
                          ? 'bg-green-600 border-green-500'
                          : 'bg-gray-700 border-gray-600'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all',
                          newQRequired ? 'left-4' : 'left-0.5'
                        )}
                      />
                    </button>
                    <span className="font-cond text-[11px] text-muted">Required field</span>
                  </div>
                  <Btn variant="primary" className="w-full" onClick={addQuestion}>
                    <Plus size={12} className="inline mr-1" /> ADD QUESTION
                  </Btn>
                </div>
              </div>

              {/* Question list grouped by section */}
              <div className="space-y-4">
                {SECTIONS.map((section) => {
                  const sectionQs = questions.filter((q) => q.section === section)
                  if (sectionQs.length === 0) return null
                  return (
                    <div key={section}>
                      <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                        {SECTION_LABELS[section]} ({sectionQs.length})
                      </div>
                      <div className="space-y-2">
                        {sectionQs.map((q) => (
                          <div
                            key={q.id}
                            className={cn(
                              'flex items-start gap-2 bg-surface-card border rounded-lg px-3 py-2.5',
                              q.is_active ? 'border-border' : 'border-border/40 opacity-50'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-cond font-bold text-[12px] text-white">
                                  {q.question_text}
                                </span>
                                {q.is_required && (
                                  <span className="font-cond text-[9px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">
                                    REQUIRED
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span
                                  className={cn(
                                    'font-cond font-bold px-1.5 py-0.5 rounded',
                                    SECTION_COLORS[q.section]
                                  )}
                                >
                                  {q.section}
                                </span>
                                <span className="text-muted">{q.question_type}</span>
                                {q.options && (
                                  <span className="text-muted">{q.options.length} options</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => toggleRequired(q.id, q.is_required)}
                                title="Toggle required"
                                className={cn(
                                  'font-cond text-[9px] font-bold px-1.5 py-1 rounded border transition-colors',
                                  q.is_required
                                    ? 'border-red-800/50 text-red-400 bg-red-900/20 hover:bg-surface-card'
                                    : 'border-border text-muted hover:text-red-400'
                                )}
                              >
                                REQ
                              </button>
                              <button
                                onClick={() => toggleQuestion(q.id, q.is_active)}
                                className="text-muted hover:text-white transition-colors"
                              >
                                {q.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                              <button
                                onClick={() => deleteQuestion(q.id, q.question_text)}
                                className="text-muted hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
