'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Save, ChevronRight, CheckCircle, Trophy, Calendar,
  MapPin, Settings, Globe, Users, BarChart2, Sliders,
  FileText, Upload, X, Plus, Trash2,
} from 'lucide-react'

type SetupStep = 'sport' | 'type' | 'details' | 'done'
type SettingsTab = 'general' | 'schedule' | 'public' | 'scoring' | 'advanced' | 'branding'

const SPORTS = [
  { name: 'Lacrosse', icon: '🥍' },
  { name: 'Soccer',   icon: '⚽' },
  { name: 'Basketball', icon: '🏀' },
  { name: 'Baseball', icon: '⚾' },
  { name: 'Softball', icon: '🥎' },
  { name: 'Volleyball', icon: '🏐' },
  { name: 'Football', icon: '🏈' },
  { name: 'Hockey',   icon: '🏒' },
  { name: 'Tennis',   icon: '🎾' },
  { name: 'Swimming', icon: '🏊' },
  { name: 'Track',    icon: '🏃' },
  { name: 'Wrestling',icon: '🤼' },
  { name: 'Other',    icon: '🏆' },
]

const EVENT_TYPES = [
  { id: 'tournament', label: 'Tournament',  desc: 'Single event with pool play and/or bracket', icon: '🏆' },
  { id: 'season',     label: 'Season',      desc: 'Ongoing league play across multiple weeks',  icon: '📅' },
  { id: 'clinic',     label: 'Clinic',      desc: 'Training or instructional event',            icon: '📋' },
  { id: 'league',     label: 'League',      desc: 'Structured competition with standings',      icon: '🏅' },
]

const TIMEZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii']

const inp = 'w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors'
const lbl = 'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'
const sectionHdr = 'font-cond text-[12px] font-black tracking-[.12em] text-white uppercase mb-3 flex items-center gap-2'

interface EventData {
  id?: number
  name: string
  sport: string
  event_type: string
  location: string
  start_date: string
  end_date: string
  time_zone: string
  status: string
  // General
  message: string
  hotel_link: string
  results_link: string
  external_id: string
  info_url: string
  // Schedule
  schedule_increment: number
  time_between_games: number
  game_guarantee: number
  max_athletes_per_roster: number
  lock_roster_date: string
  age_compute_date: string
  highlight_schedule_changes: number
  back_to_back_warning: boolean
  // Public flags
  public_schedule: boolean
  show_brackets: boolean
  show_team_list: boolean
  show_seeding: boolean
  show_team_pool: boolean
  show_bracket_games: boolean
  show_team_contact_info: boolean
  show_team_city_state: boolean
  allow_public_post_scores: boolean
  show_stat_leaders: boolean
  // Scoring
  allow_ties: boolean
  show_goals_scored: boolean
  show_goals_allowed: boolean
  show_goal_diff: boolean
  show_head_to_head: boolean
  points_for_win: number
  points_for_tie: number
  points_for_loss: number
  // Advanced
  exhibition_games: boolean
  schedule_home_games: boolean
  assign_work_teams: boolean
  assign_bonus_points: boolean
  game_by_game_stats: boolean
  auto_advance_pool_play: boolean
  filter_drag_drop: boolean
  periods_per_game: number
  minutes_per_period: number
  max_sets_per_match: number
  // Referee requirements
  ref_requirements: Record<string, { adult: number; youth: number }>
  // Terms
  division_term: string
  game_term_team1: string
  game_term_team2: string
  classification: string
  tournament_series: string
  // Branding
  logo_url: string | null
  park_name: string
  primary_color: string
  secondary_color: string
}

const DEFAULT_EVENT: Omit<EventData, 'id'> = {
  name: '', sport: 'Lacrosse', event_type: 'tournament',
  location: '', start_date: '', end_date: '',
  time_zone: 'Eastern', status: 'draft',
  message: '', hotel_link: '', results_link: '', external_id: '', info_url: '',
  schedule_increment: 60, time_between_games: 0, game_guarantee: 0,
  max_athletes_per_roster: 0, lock_roster_date: '', age_compute_date: '',
  highlight_schedule_changes: 0, back_to_back_warning: true,
  public_schedule: false, show_brackets: true, show_team_list: true,
  show_seeding: false, show_team_pool: false, show_bracket_games: true,
  show_team_contact_info: false, show_team_city_state: true,
  allow_public_post_scores: false, show_stat_leaders: false,
  allow_ties: false, show_goals_scored: false, show_goals_allowed: false,
  show_goal_diff: false, show_head_to_head: false,
  points_for_win: 0, points_for_tie: 0, points_for_loss: 0,
  exhibition_games: false, schedule_home_games: false, assign_work_teams: false,
  assign_bonus_points: false, game_by_game_stats: false,
  auto_advance_pool_play: false, filter_drag_drop: false,
  periods_per_game: 0, minutes_per_period: 0, max_sets_per_match: 0,
  ref_requirements: { U8: { adult: 0, youth: 2 }, U10: { adult: 1, youth: 1 }, default: { adult: 2, youth: 0 } },
  division_term: 'Division', game_term_team1: 'Away', game_term_team2: 'Home',
  classification: '', tournament_series: '',
  logo_url: null, park_name: '', primary_color: '#0B3D91', secondary_color: '#D62828',
}

export function EventSetupTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading]       = useState(true)
  const [hasEvent, setHasEvent]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [setupStep, setSetupStep]   = useState<SetupStep>('sport')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [event, setEvent]           = useState<EventData>({ ...DEFAULT_EVENT })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile]     = useState<File | null>(null)

  useEffect(() => { loadEvent() }, [])

  async function loadEvent() {
    const sb = createClient()
    const { data } = await sb.from('events').select('*').eq('id', 1).single()
    if (data && (data as any).name) {
      const d = data as any
      setEvent({
        id:       d.id,
        name:     d.name ?? '',
        sport:    d.sport ?? 'Lacrosse',
        event_type: d.event_type ?? 'tournament',
        location: d.location ?? '',
        start_date: d.start_date ?? '',
        end_date:   d.end_date ?? '',
        time_zone:  d.time_zone ?? 'Eastern',
        status:     d.status ?? 'draft',
        message:    d.message ?? '',
        hotel_link: d.hotel_link ?? '',
        results_link: d.results_link ?? '',
        external_id:  d.external_id ?? '',
        info_url:     d.info_url ?? '',
        schedule_increment:     d.schedule_increment ?? 60,
        time_between_games:     d.time_between_games ?? 0,
        game_guarantee:         d.game_guarantee ?? 0,
        max_athletes_per_roster: d.max_athletes_per_roster ?? 0,
        lock_roster_date:       d.lock_roster_date ?? '',
        age_compute_date:       d.age_compute_date ?? '',
        highlight_schedule_changes: d.highlight_schedule_changes ?? 0,
        back_to_back_warning:   d.back_to_back_warning ?? true,
        public_schedule:        d.public_schedule ?? false,
        show_brackets:          d.show_brackets ?? true,
        show_team_list:         d.show_team_list ?? true,
        show_seeding:           d.show_seeding ?? false,
        show_team_pool:         d.show_team_pool ?? false,
        show_bracket_games:     d.show_bracket_games ?? true,
        show_team_contact_info: d.show_team_contact_info ?? false,
        show_team_city_state:   d.show_team_city_state ?? true,
        allow_public_post_scores: d.allow_public_post_scores ?? false,
        show_stat_leaders:      d.show_stat_leaders ?? false,
        allow_ties:             d.allow_ties ?? false,
        show_goals_scored:      d.show_goals_scored ?? false,
        show_goals_allowed:     d.show_goals_allowed ?? false,
        show_goal_diff:         d.show_goal_diff ?? false,
        show_head_to_head:      d.show_head_to_head ?? false,
        points_for_win:         d.points_for_win ?? 0,
        points_for_tie:         d.points_for_tie ?? 0,
        points_for_loss:        d.points_for_loss ?? 0,
        exhibition_games:       d.exhibition_games ?? false,
        schedule_home_games:    d.schedule_home_games ?? false,
        assign_work_teams:      d.assign_work_teams ?? false,
        assign_bonus_points:    d.assign_bonus_points ?? false,
        game_by_game_stats:     d.game_by_game_stats ?? false,
        auto_advance_pool_play: d.auto_advance_pool_play ?? false,
        filter_drag_drop:       d.filter_drag_drop ?? false,
        periods_per_game:       d.periods_per_game ?? 0,
        minutes_per_period:     d.minutes_per_period ?? 0,
        max_sets_per_match:     d.max_sets_per_match ?? 0,
        ref_requirements:       d.ref_requirements ?? { U8: { adult: 0, youth: 2 }, U10: { adult: 1, youth: 1 }, default: { adult: 2, youth: 0 } },
        division_term:          d.division_term ?? 'Division',
        game_term_team1:        d.game_term_team1 ?? 'Away',
        game_term_team2:        d.game_term_team2 ?? 'Home',
        classification:         d.classification ?? '',
        tournament_series:      d.tournament_series ?? '',
        logo_url:               d.logo_url ?? null,
        park_name:              d.park_name ?? '',
        primary_color:          d.primary_color ?? '#0B3D91',
        secondary_color:        d.secondary_color ?? '#D62828',
      })
      setLogoPreview(d.logo_url ?? null)
      setHasEvent(true)
    }
    setLoading(false)
  }

  function set<K extends keyof EventData>(key: K, val: EventData[K]) {
    setEvent(prev => ({ ...prev, [key]: val }))
  }

  function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Image files only'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = e => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function createEvent() {
    if (!event.name || !event.start_date || !event.end_date || !event.location) {
      toast.error('Name, location, and dates are required'); return
    }
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('events').update({
      name: event.name, sport: event.sport, event_type: event.event_type,
      location: event.location, start_date: event.start_date,
      end_date: event.end_date, time_zone: event.time_zone,
      status: 'draft',
    }).eq('id', 1)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(`${event.name} created!`)
    setHasEvent(true)
    setSaving(false)
  }

  async function saveSettings() {
    setSaving(true)
    const sb = createClient()

    let finalLogoUrl = event.logo_url
    if (logoFile) {
      const ext = logoFile.name.split('.').pop() ?? 'png'
      const { error: upErr } = await sb.storage.from('program-assets')
        .upload(`events/1/logo.${ext}`, logoFile, { upsert: true, contentType: logoFile.type })
      if (!upErr) {
        finalLogoUrl = sb.storage.from('program-assets').getPublicUrl(`events/1/logo.${ext}`).data.publicUrl
        setLogoFile(null)
      }
    }

    const { error } = await sb.from('events').update({
      ...event, logo_url: finalLogoUrl, updated_at: new Date().toISOString(),
    }).eq('id', 1)

    if (error) toast.error(error.message)
    else { toast.success('Settings saved'); set('logo_url', finalLogoUrl) }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted font-cond">LOADING...</div>
  )

  // ── CREATE WIZARD ──────────────────────────────────────────
  if (!hasEvent) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-7 rounded-sm bg-red" />
          <div>
            <div className="font-cond text-[24px] font-black tracking-[.08em] text-white">CREATE EVENT</div>
            <div className="font-cond text-[12px] text-muted">Set up a tournament, season, clinic, or league</div>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8">
          {['sport','type','details'].map((s, i) => {
            const steps = ['sport','type','details']
            const cur   = steps.indexOf(setupStep)
            const mine  = steps.indexOf(s)
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center font-cond text-[12px] font-black flex-shrink-0',
                  mine < cur  ? 'bg-green-600 text-white' :
                  mine === cur ? 'border-2 border-blue-400 bg-[#081428] text-white' :
                  'border border-[#1a2d50] bg-[#081428] text-muted'
                )}>{mine < cur ? '✓' : i + 1}</div>
                <span className={cn('font-cond text-[11px] font-black tracking-[.1em] uppercase',
                  mine === cur ? 'text-white' : mine < cur ? 'text-green-400' : 'text-muted'
                )}>{ ['Sport','Type','Details'][i] }</span>
                {i < 2 && <div className="flex-1 h-px bg-[#1a2d50] ml-2" />}
              </div>
            )
          })}
        </div>

        {/* Step 1: Sport */}
        {setupStep === 'sport' && (
          <div>
            <div className="font-cond text-[14px] font-black tracking-wide text-white mb-4">SELECT SPORT</div>
            <div className="grid grid-cols-4 gap-3">
              {SPORTS.map(s => (
                <button key={s.name} onClick={() => { set('sport', s.name); setSetupStep('type') }}
                  className={cn('flex flex-col items-center gap-2 py-5 rounded-xl border transition-all hover:border-blue-400',
                    event.sport === s.name ? 'border-blue-400 bg-[#0d1f3a]' : 'border-[#1a2d50] bg-[#081428]'
                  )}>
                  <span className="text-3xl">{s.icon}</span>
                  <span className="font-cond text-[11px] font-black tracking-[.1em] text-white">{s.name.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Event Type */}
        {setupStep === 'type' && (
          <div>
            <div className="font-cond text-[14px] font-black tracking-wide text-white mb-4">EVENT TYPE</div>
            <div className="grid grid-cols-2 gap-4">
              {EVENT_TYPES.map(t => (
                <button key={t.id} onClick={() => { set('event_type', t.id); setSetupStep('details') }}
                  className={cn('flex items-start gap-4 p-5 rounded-xl border text-left transition-all hover:border-blue-400',
                    event.event_type === t.id ? 'border-blue-400 bg-[#0d1f3a]' : 'border-[#1a2d50] bg-[#081428]'
                  )}>
                  <span className="text-3xl flex-shrink-0 mt-0.5">{t.icon}</span>
                  <div>
                    <div className="font-cond text-[15px] font-black text-white mb-1">{t.label}</div>
                    <div className="font-cond text-[11px] text-muted leading-snug">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setSetupStep('sport')} className="mt-4 font-cond text-[11px] text-muted hover:text-white">← Back</button>
          </div>
        )}

        {/* Step 3: Details */}
        {setupStep === 'details' && (
          <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">{SPORTS.find(s => s.name === event.sport)?.icon}</span>
              <div>
                <div className="font-cond text-[15px] font-black text-white">
                  {EVENT_TYPES.find(t => t.id === event.event_type)?.label} Details
                </div>
                <div className="font-cond text-[11px] text-muted">{event.sport}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={lbl}>Event Name *</label>
                <input className={inp} value={event.name} onChange={e => set('name', e.target.value)}
                  placeholder={`e.g. Knights ${event.sport} ${EVENT_TYPES.find(t=>t.id===event.event_type)?.label} 2025`} autoFocus />
              </div>

              <div>
                <label className={lbl}>Location / Venue *</label>
                <input className={inp} value={event.location} onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Julington Creek Plantation Park, Jacksonville FL" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Start Date *</label>
                  <input type="date" className={inp} value={event.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>End Date *</label>
                  <input type="date" className={inp} value={event.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Time Zone</label>
                  <select className={inp} value={event.time_zone} onChange={e => set('time_zone', e.target.value)}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-[#1a2d50]">
              <button onClick={() => setSetupStep('type')} className="font-cond text-[11px] text-muted hover:text-white">← Back</button>
              <button onClick={createEvent} disabled={saving}
                className="flex items-center gap-2 font-cond font-black text-[13px] tracking-[.1em] px-8 py-3 rounded-xl bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50">
                {saving ? 'CREATING...' : 'CREATE EVENT →'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── GENERAL SETTINGS (tabs) ─────────────────────────────────
  const sport = SPORTS.find(s => s.name === event.sport)
  const evType = EVENT_TYPES.find(t => t.id === event.event_type)

  const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',  label: 'General',    icon: <Settings size={13} /> },
    { id: 'schedule', label: 'Schedule',   icon: <Calendar size={13} /> },
    { id: 'public',   label: 'Public',     icon: <Globe size={13} /> },
    { id: 'scoring',  label: 'Scoring',    icon: <BarChart2 size={13} /> },
    { id: 'advanced', label: 'Advanced',   icon: <Sliders size={13} /> },
    { id: 'branding', label: 'Branding',   icon: <FileText size={13} /> },
  ]

  return (
    <div>
      {/* Event header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: '#081428', border: '1px solid #1a2d50' }}>
            {sport?.icon}
          </div>
          <div>
            <div className="font-cond text-[22px] font-black text-white leading-tight">{event.name}</div>
            <div className="font-cond text-[11px] text-muted">
              {evType?.label} · {event.sport} · {event.location}
              {event.start_date && ` · ${new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
              {event.end_date && event.end_date !== event.start_date && ` – ${new Date(event.end_date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            {(['draft','active','completed'] as const).map(s => (
              <button key={s} onClick={() => set('status', s)}
                className={cn('font-cond text-[10px] font-black tracking-[.12em] px-3 py-1.5 rounded transition-all',
                  event.status === s
                    ? s === 'active' ? 'bg-green-700 text-white' : s === 'draft' ? 'bg-[#1a2d50] text-white' : 'bg-gray-700 text-white'
                    : 'bg-[#081428] border border-[#1a2d50] text-muted hover:text-white'
                )}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <button onClick={saveSettings} disabled={saving}
            className="flex items-center gap-2 font-cond font-black text-[12px] tracking-[.1em] px-5 py-2 rounded-lg bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50">
            <Save size={13} /> {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* Settings sub-tabs */}
      <div className="flex border-b border-[#1a2d50] mb-5">
        {SETTINGS_TABS.map(t => (
          <button key={t.id} onClick={() => setSettingsTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 font-cond text-[11px] font-black tracking-[.1em] uppercase transition-colors relative',
              settingsTab === t.id ? 'text-white' : 'text-muted hover:text-white'
            )}>
            {t.icon}{t.label}
            {settingsTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-red" />}
          </button>
        ))}
      </div>

      <div className="max-w-3xl">

        {/* ── GENERAL ── */}
        {settingsTab === 'general' && (
          <div className="space-y-6">
            <Card title="Event Identity" icon={<Trophy size={14} />}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Tournament / Event Name</label>
                  <input className={inp} value={event.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Sport</label>
                  <select className={inp} value={event.sport} onChange={e => set('sport', e.target.value)}>
                    {SPORTS.map(s => <option key={s.name} value={s.name}>{s.icon} {s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Event Type</label>
                  <select className={inp} value={event.event_type} onChange={e => set('event_type', e.target.value)}>
                    {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>General Location</label>
                  <input className={inp} value={event.location} onChange={e => set('location', e.target.value)} placeholder="Venue / Park name, City" />
                </div>
                <div>
                  <label className={lbl}>Classification</label>
                  <input className={inp} value={event.classification} onChange={e => set('classification', e.target.value)} placeholder="e.g. Varsity, JV, Youth" />
                </div>
                <div>
                  <label className={lbl}>Tournament Series</label>
                  <input className={inp} value={event.tournament_series} onChange={e => set('tournament_series', e.target.value)} placeholder="Series name if applicable" />
                </div>
                <div>
                  <label className={lbl}>External Tournament ID</label>
                  <input className={inp} value={event.external_id} onChange={e => set('external_id', e.target.value)} placeholder="ID in another system" />
                </div>
              </div>
            </Card>

            <Card title="Dates & Time" icon={<Calendar size={14} />}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Start Date</label>
                  <input type="date" className={inp} value={event.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>End Date</label>
                  <input type="date" className={inp} value={event.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Time Zone</label>
                  <select className={inp} value={event.time_zone} onChange={e => set('time_zone', e.target.value)}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Age Compute Date</label>
                  <input type="date" className={inp} value={event.age_compute_date} onChange={e => set('age_compute_date', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Lock Roster Date</label>
                  <input type="date" className={inp} value={event.lock_roster_date} onChange={e => set('lock_roster_date', e.target.value)} />
                  <div className="font-cond text-[9px] text-muted mt-1">Date coaches can no longer edit rosters</div>
                </div>
              </div>
            </Card>

            <Card title="Links & Info" icon={<Globe size={14} />}>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Results Link</label>
                  <input className={inp} value={event.results_link} onChange={e => set('results_link', e.target.value)} placeholder="https://" />
                </div>
                <div>
                  <label className={lbl}>Tournament Info URL</label>
                  <input className={inp} value={event.info_url} onChange={e => set('info_url', e.target.value)} placeholder="External info page https://" />
                </div>
                <div>
                  <label className={lbl}>Hotel Link</label>
                  <input className={inp} value={event.hotel_link} onChange={e => set('hotel_link', e.target.value)} placeholder="Hotel/travel deals URL" />
                </div>
                <div>
                  <label className={lbl}>Public Results Message</label>
                  <textarea className={cn(inp, 'resize-y min-h-[70px]')} value={event.message} onChange={e => set('message', e.target.value)}
                    placeholder="Message displayed on the public results page" />
                </div>
              </div>
            </Card>

            <Card title="Terminology" icon={<FileText size={14} />}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Division Term</label>
                  <input className={inp} value={event.division_term} onChange={e => set('division_term', e.target.value)} placeholder="Division" />
                  <div className="font-cond text-[9px] text-muted mt-1">e.g. Region, Class, Pool</div>
                </div>
                <div>
                  <label className={lbl}>Team 1 Label</label>
                  <input className={inp} value={event.game_term_team1} onChange={e => set('game_term_team1', e.target.value)} placeholder="Away" />
                </div>
                <div>
                  <label className={lbl}>Team 2 Label</label>
                  <input className={inp} value={event.game_term_team2} onChange={e => set('game_term_team2', e.target.value)} placeholder="Home" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {settingsTab === 'schedule' && (
          <div className="space-y-6">
            <Card title="Game Timing" icon={<Calendar size={14} />}>
              <div className="grid grid-cols-2 gap-4">
                <NumField label="Schedule Increment (minutes)" help="Total minutes allocated per game slot"
                  value={event.schedule_increment} onChange={v => set('schedule_increment', v)} />
                <NumField label="Time Between Games (minutes)" help="Buffer time between game slots"
                  value={event.time_between_games} onChange={v => set('time_between_games', v)} />
                <NumField label="Game Guarantee" help="Minimum games each team is guaranteed"
                  value={event.game_guarantee} onChange={v => set('game_guarantee', v)} />
                <NumField label="Highlight Schedule Changes (days)" help="Highlight games changed within N days"
                  value={event.highlight_schedule_changes} onChange={v => set('highlight_schedule_changes', v)} />
                <NumField label="Periods / Innings per Game" help="Used for tablet scoring"
                  value={event.periods_per_game} onChange={v => set('periods_per_game', v)} />
                <NumField label="Minutes per Period" help="Used for tablet scoring"
                  value={event.minutes_per_period} onChange={v => set('minutes_per_period', v)} />
                <NumField label="Max Sets per Match" help="Used for volleyball/tennis"
                  value={event.max_sets_per_match} onChange={v => set('max_sets_per_match', v)} />
                <NumField label="Max Athletes per Roster"
                  value={event.max_athletes_per_roster} onChange={v => set('max_athletes_per_roster', v)} />
              </div>
            </Card>
            <Card title="Schedule Options">
              <div className="space-y-1">
                <Toggle label="Back to Back Warning" help="Warn when scheduling a team with back-to-back games"
                  value={event.back_to_back_warning} onChange={v => set('back_to_back_warning', v)} />
                <Toggle label="Schedule Home Games" help="Auto-scheduler schedules games at team's home facility"
                  value={event.schedule_home_games} onChange={v => set('schedule_home_games', v)} />
                <Toggle label="Filter Drag & Drop Screen" help="Specify dates/complexes shown on the drag-and-drop screen"
                  value={event.filter_drag_drop} onChange={v => set('filter_drag_drop', v)} />
              </div>
            </Card>
          </div>
        )}

        {/* ── PUBLIC ── */}
        {settingsTab === 'public' && (
          <div className="space-y-6">
            <Card title="Public Schedule" icon={<Globe size={14} />}>
              <div className="space-y-1">
                <Toggle label="Make Schedule Public" help="Show schedule on public results page (disabled in Draft mode)"
                  value={event.public_schedule} onChange={v => set('public_schedule', v)}
                  highlight={!event.public_schedule && event.status === 'draft'} highlightMsg="Switch status to Active to enable" />
                <Toggle label="Allow Public to Post Scores" value={event.allow_public_post_scores} onChange={v => set('allow_public_post_scores', v)} />
                <Toggle label="Show Team Contact Info" help="Show coaches and team rep info publicly"
                  value={event.show_team_contact_info} onChange={v => set('show_team_contact_info', v)} />
                <Toggle label="Show Team City / State" value={event.show_team_city_state} onChange={v => set('show_team_city_state', v)} />
              </div>
            </Card>
            <Card title="Results Page Display">
              <div className="space-y-1">
                <Toggle label="Show Brackets" value={event.show_brackets} onChange={v => set('show_brackets', v)} />
                <Toggle label="Show Team List" value={event.show_team_list} onChange={v => set('show_team_list', v)} />
                <Toggle label="Show Seeding" help="Show team seed or initial pool placement on bracket"
                  value={event.show_seeding} onChange={v => set('show_seeding', v)} />
                <Toggle label="Show Team Pool" value={event.show_team_pool} onChange={v => set('show_team_pool', v)} />
                <Toggle label="Show Bracket Games" value={event.show_bracket_games} onChange={v => set('show_bracket_games', v)} />
                <Toggle label="Show Stat Leaders" value={event.show_stat_leaders} onChange={v => set('show_stat_leaders', v)} />
              </div>
            </Card>
          </div>
        )}

        {/* ── SCORING ── */}
        {settingsTab === 'scoring' && (
          <div className="space-y-6">
            <Card title="Points" icon={<BarChart2 size={14} />}>
              <div className="grid grid-cols-3 gap-4">
                <NumField label="Points for Win" value={event.points_for_win} onChange={v => set('points_for_win', v)} />
                <NumField label="Points for Tie" value={event.points_for_tie} onChange={v => set('points_for_tie', v)} />
                <NumField label="Points for Loss" value={event.points_for_loss} onChange={v => set('points_for_loss', v)} />
              </div>
            </Card>
            <Card title="Goals & Stats Display">
              <div className="space-y-1">
                <Toggle label="Allow Ties" value={event.allow_ties} onChange={v => set('allow_ties', v)} />
                <Toggle label="Show Goals Scored" value={event.show_goals_scored} onChange={v => set('show_goals_scored', v)} />
                <Toggle label="Show Goals Allowed" value={event.show_goals_allowed} onChange={v => set('show_goals_allowed', v)} />
                <Toggle label="Show Goal Differential" value={event.show_goal_diff} onChange={v => set('show_goal_diff', v)} />
                <Toggle label="Show Head to Head Score / Goal Diff" value={event.show_head_to_head} onChange={v => set('show_head_to_head', v)} />
                <Toggle label="Game-by-Game Stats" help="Enter stats for each athlete in each game"
                  value={event.game_by_game_stats} onChange={v => set('game_by_game_stats', v)} />
              </div>
            </Card>
            <Card title="Bracket">
              <div className="space-y-1">
                <Toggle label="Auto Advance from Pool Play" help="Teams automatically seeded and advanced to bracket after pool play"
                  value={event.auto_advance_pool_play} onChange={v => set('auto_advance_pool_play', v)} />
              </div>
            </Card>
          </div>
        )}

        {/* ── ADVANCED ── */}
        {settingsTab === 'advanced' && (
          <div className="space-y-6">
            <Card title="Game Features" icon={<Sliders size={14} />}>
              <div className="space-y-1">
                <Toggle label="Exhibition Games" help="Mark individual games as exhibition — won't count toward pool record"
                  value={event.exhibition_games} onChange={v => set('exhibition_games', v)} />
                <Toggle label="Assign Work Teams" help="Assign work teams to games (commonly used in volleyball)"
                  value={event.assign_work_teams} onChange={v => set('assign_work_teams', v)} />
                <Toggle label="Assign Bonus Points to Games" help="Assign bonus points to teams in a game"
                  value={event.assign_bonus_points} onChange={v => set('assign_bonus_points', v)} />
              </div>
            </Card>

            <RefRequirementsCard
              value={event.ref_requirements}
              onChange={v => set('ref_requirements', v)}
            />
          </div>
        )}

        {/* ── BRANDING ── */}
        {settingsTab === 'branding' && (
          <div className="space-y-6">
            <Card title="Event Logo" icon={<FileText size={14} />}>
              <div className="flex items-start gap-6">
                {logoPreview ? (
                  <div className="relative">
                    <div className="w-28 h-28 rounded-xl border border-[#1a2d50] bg-white/5 flex items-center justify-center overflow-hidden">
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                    </div>
                    <button onClick={() => { setLogoPreview(null); setLogoFile(null); set('logo_url', null) }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red rounded-full flex items-center justify-center">
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-28 h-28 rounded-xl border-2 border-dashed border-[#1a2d50] hover:border-blue-400 flex flex-col items-center justify-center gap-2 transition-colors">
                    <Upload size={20} className="text-muted" />
                    <span className="font-cond text-[9px] text-muted">UPLOAD</span>
                  </button>
                )}
                <div className="flex-1">
                  <div className="font-cond text-[12px] text-muted mb-3 leading-relaxed">
                    Appears on player cards, public results, and printed materials. PNG/JPG, max 3MB. Square logos work best.
                  </div>
                  <button onClick={() => fileRef.current?.click()}
                    className="font-cond text-[11px] font-black tracking-[.1em] px-4 py-2 rounded-lg border border-[#1a2d50] text-muted hover:text-white transition-colors">
                    {logoPreview ? 'CHANGE LOGO' : 'CHOOSE FILE'}
                  </button>
                  {logoFile && <div className="font-cond text-[10px] text-blue-400 mt-2">✓ {logoFile.name} — save to upload</div>}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
            </Card>

            <Card title="Brand Colors">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <div className="w-10 h-10 rounded-lg border border-[#1a2d50] overflow-hidden flex-shrink-0">
                      <input type="color" value={event.primary_color} onChange={e => set('primary_color', e.target.value)}
                        className="w-full h-full cursor-pointer border-0 p-0" />
                    </div>
                    <input className={cn(inp, 'font-mono')} value={event.primary_color}
                      onChange={e => set('primary_color', e.target.value)} maxLength={7} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <div className="w-10 h-10 rounded-lg border border-[#1a2d50] overflow-hidden flex-shrink-0">
                      <input type="color" value={event.secondary_color} onChange={e => set('secondary_color', e.target.value)}
                        className="w-full h-full cursor-pointer border-0 p-0" />
                    </div>
                    <input className={cn(inp, 'font-mono')} value={event.secondary_color}
                      onChange={e => set('secondary_color', e.target.value)} maxLength={7} />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="mt-4 rounded-lg overflow-hidden border border-[#1a2d50]">
                <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: event.primary_color }}>
                  {logoPreview && <img src={logoPreview} alt="" className="w-6 h-6 object-contain rounded" />}
                  <span className="font-cond font-black text-white text-[13px] tracking-widest">LEAGUEOPS</span>
                  <span className="font-cond text-[10px] text-white/60 ml-auto">{event.name}</span>
                </div>
                <div className="h-0.5" style={{ background: event.secondary_color }} />
              </div>
            </Card>

            <Card title="Park / Complex">
              <div>
                <label className={lbl}>Complex / Park Name</label>
                <input className={inp} value={event.park_name} onChange={e => set('park_name', e.target.value)}
                  placeholder="e.g. Julington Creek Plantation Park" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1a2d50]">
        {icon && <span className="text-muted">{icon}</span>}
        <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Toggle({ label, help, value, onChange, highlight, highlightMsg }: {
  label: string; help?: string; value: boolean; onChange: (v: boolean) => void
  highlight?: boolean; highlightMsg?: string
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#0d1a2e] last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="font-cond text-[13px] font-bold text-white">{label}</div>
        {help && <div className="font-cond text-[10px] text-muted mt-0.5 leading-snug">{help}</div>}
        {highlight && highlightMsg && <div className="font-cond text-[10px] text-yellow-500 mt-0.5">{highlightMsg}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className={cn('relative w-10 h-5 rounded-full border-2 flex-shrink-0 transition-all',
          value ? 'bg-blue-600 border-blue-500' : 'bg-[#0d1a2e] border-[#1a2d50]'
        )}>
        <span className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all',
          value ? 'left-[18px]' : 'left-0.5'
        )} />
      </button>
    </div>
  )
}

function NumField({ label, help, value, onChange }: {
  label: string; help?: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5">{label}</label>
      <input type="number" min={0}
        className="w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors font-mono"
        value={value} onChange={e => onChange(Number(e.target.value))} />
      {help && <div className="font-cond text-[9px] text-muted mt-1 leading-snug">{help}</div>}
    </div>
  )
}

// ── Referee Requirements Card ─────────────────────────────────

type RefRules = Record<string, { adult: number; youth: number }>

function RefRequirementsCard({ value, onChange }: {
  value: RefRules
  onChange: (v: RefRules) => void
}) {
  const [newDiv, setNewDiv] = useState('')

  // Separate division rows from 'default'
  const divRows = Object.entries(value).filter(([k]) => k !== 'default').sort(([a], [b]) => a.localeCompare(b))
  const def = value['default'] ?? { adult: 2, youth: 0 }

  function updateRule(div: string, field: 'adult' | 'youth', n: number) {
    onChange({ ...value, [div]: { ...value[div], [field]: Math.max(0, n) } })
  }

  function removeRule(div: string) {
    const next = { ...value }
    delete next[div]
    onChange(next)
  }

  function addRule() {
    const d = newDiv.trim()
    if (!d || value[d]) return
    onChange({ ...value, [d]: { adult: 2, youth: 0 } })
    setNewDiv('')
  }

  const numInp = 'w-14 bg-[#050f20] border border-[#1a2d50] text-white text-center px-2 py-1.5 rounded text-[13px] font-mono outline-none focus:border-blue-400 transition-colors'

  return (
    <Card title="Referee Requirements" icon={<Users size={14} />}>
      <div className="font-cond text-[10px] text-muted mb-4 leading-relaxed">
        Set how many adult and youth referees are required per game, by division.
        The <span className="text-white font-bold">Default</span> row applies to any division not listed above it.
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 mb-1 px-1">
        <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">Division</span>
        <span className="font-cond text-[9px] font-black tracking-[.12em] text-[#60a5fa] uppercase text-center">Adult Refs</span>
        <span className="font-cond text-[9px] font-black tracking-[.12em] text-[#34d399] uppercase text-center">Youth Refs</span>
        <span />
      </div>

      <div className="space-y-1.5">
        {divRows.map(([div, rule]) => (
          <div key={div} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center px-1 py-1 rounded hover:bg-[#050f20] group">
            <span className="font-cond text-[13px] font-bold text-white">{div}</span>
            <div className="flex justify-center">
              <input type="number" min={0} max={9} className={numInp}
                value={rule.adult} onChange={e => updateRule(div, 'adult', Number(e.target.value))} />
            </div>
            <div className="flex justify-center">
              <input type="number" min={0} max={9} className={numInp}
                value={rule.youth} onChange={e => updateRule(div, 'youth', Number(e.target.value))} />
            </div>
            <button onClick={() => removeRule(div)}
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded hover:bg-red/20 transition-all">
              <Trash2 size={12} className="text-red-400" />
            </button>
          </div>
        ))}

        {/* Default row */}
        <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center px-1 py-1 rounded border-t border-[#1a2d50] mt-2 pt-3">
          <span className="font-cond text-[11px] font-black tracking-[.08em] text-muted uppercase">All Other Divisions</span>
          <div className="flex justify-center">
            <input type="number" min={0} max={9} className={numInp}
              value={def.adult} onChange={e => updateRule('default', 'adult', Number(e.target.value))} />
          </div>
          <div className="flex justify-center">
            <input type="number" min={0} max={9} className={numInp}
              value={def.youth} onChange={e => updateRule('default', 'youth', Number(e.target.value))} />
          </div>
          <span />
        </div>
      </div>

      {/* Add division row */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#1a2d50]">
        <input
          value={newDiv}
          onChange={e => setNewDiv(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addRule()}
          placeholder="Division name (e.g. U8, U12B)"
          className="flex-1 bg-[#050f20] border border-[#1a2d50] text-white px-3 py-1.5 rounded text-[12px] font-cond outline-none focus:border-blue-400 placeholder:text-[#1a2d50] transition-colors"
        />
        <button onClick={addRule} disabled={!newDiv.trim() || !!value[newDiv.trim()]}
          className="flex items-center gap-1.5 font-cond text-[11px] font-black tracking-[.08em] px-3 py-1.5 rounded border border-[#1a2d50] text-muted hover:text-white hover:border-blue-400 disabled:opacity-30 transition-all">
          <Plus size={12} /> ADD
        </button>
      </div>
    </Card>
  )
}
