'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { seedDefaultRules } from '@/lib/engines/schedule-rules'
import {
  Plus,
  LogOut,
  Calendar,
  MapPin,
  ChevronRight,
  Trophy,
  Copy,
  CheckCircle,
  ArrowLeft,
  Settings,
  Users,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { VenueAutocompleteInput } from './VenueAutocompleteInput'

interface EventSummary {
  id: number
  name: string
  sport: string
  event_type: string
  location: string
  start_date: string
  end_date: string
  status: string
  logo_url: string | null
  event_code: string | null
  slug: string | null
  primary_color: string | null
}

interface Props {
  onSelectEvent: (eventId: number, isNew?: boolean) => void
  onSwitchToProgram?: () => void
  programLeaderRole?: unknown
}

const SPORTS_EMOJI: Record<string, string> = {
  Lacrosse: '🥍',
  Soccer: '⚽',
  Basketball: '🏀',
  Baseball: '⚾',
  Softball: '🥎',
  Volleyball: '🏐',
  Football: '🏈',
  Hockey: '🏒',
  Tennis: '🎾',
  Swimming: '🏊',
  Track: '🏃',
  Wrestling: '🤼',
  Other: '🏆',
}

export function EventPicker({ onSelectEvent, onSwitchToProgram }: Props) {
  const { userRole, signOut } = useAuth()
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Venue search state
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
  const [selectedVenueAddress, setSelectedVenueAddress] = useState<string>('')

  // Wizard state
  const [step, setStep] = useState<1 | 2>(1)
  const [showForm, setShowForm] = useState(false)

  // Step 1 — event details
  const [newName, setNewName] = useState('')
  const [newSport, setNewSport] = useState('Lacrosse')
  const [newType, setNewType] = useState('tournament')
  const [newLocation, setNewLocation] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')

  // Step 2 — copy options
  const [copySourceId, setCopySourceId] = useState<number | null>(null)
  const [copySettings, setCopySettings] = useState(true) // fields + rules
  const [copyRefsVols, setCopyRefsVols] = useState(true) // referees + volunteers

  // Primary complex (required on creation)
  const [complexName, setComplexName] = useState('')
  const [complexAddress, setComplexAddress] = useState('')

  // Additional copy categories
  const [copyTeams, setCopyTeams] = useState(false)
  const [copyComplexes, setCopyComplexes] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    const sb = createClient()
    setLoading(true)
    const { data: adminRows } = await sb
      .from('event_admins')
      .select('event_id')
      .eq('user_id', (await sb.auth.getUser()).data.user?.id ?? '')

    const eventIds = (adminRows ?? []).map((r: any) => r.event_id)

    if (eventIds.length === 0) {
      const { data } = await sb
        .from('events')
        .select(
          'id,name,sport,event_type,location,start_date,end_date,status,logo_url,event_code,slug,primary_color'
        )
        .eq('id', 1)
        .single()
      if (data) setEvents([data as EventSummary])
    } else {
      const query = sb
        .from('events')
        .select(
          'id,name,sport,event_type,location,start_date,end_date,status,logo_url,event_code,slug,primary_color'
        )
        .in('id', eventIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      const { data } = await query
      setEvents((data as EventSummary[]) ?? [])
    }
    setLoading(false)
  }

  function goToStep2() {
    if (!newName || !newStart || !newEnd || !newLocation) {
      toast.error('Name, location, and dates required')
      return
    }
    if (!complexName.trim()) {
      toast.error('Primary complex name is required')
      return
    }
    setStep(2)
  }

  function resetForm() {
    setShowForm(false)
    setStep(1)
    setNewName('')
    setNewLocation('')
    setNewStart('')
    setNewEnd('')
    setNewSport('Lacrosse')
    setNewType('tournament')
    setCopySourceId(null)
    setCopySettings(true)
    setCopyRefsVols(true)
    setComplexName('')
    setComplexAddress('')
    setCopyTeams(false)
    setCopyComplexes(false)
    setSelectedPlaceId(null)
    setSelectedLat(null)
    setSelectedLng(null)
    setSelectedVenueAddress('')
  }

  async function createEvent() {
    setCreating(true)
    const sb = createClient()
    const user = (await sb.auth.getUser()).data.user

    // Generate unique slug — check for duplicates and append suffix if needed
    const year = new Date().getFullYear().toString()
    const nameSlug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const baseSlug = nameSlug.endsWith(`-${year}`) ? nameSlug : `${nameSlug}-${year}`

    const { count } = await sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .like('slug', `${baseSlug}%`)

    const slug = count && count > 0 ? `${baseSlug}-${count + 1}` : baseSlug

    const eventInsert: Record<string, any> = {
      name: newName,
      sport: newSport,
      event_type: newType,
      location: newLocation,
      start_date: newStart,
      end_date: newEnd,
      status: 'draft',
      slug,
      owner_id: user?.id,
      is_active: true,
      event_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      primary_color: '#0B3D91',
      secondary_color: '#D62828',
    }

    // Auto-generate public results link from slug
    eventInsert.results_link = `https://leagueops-live.vercel.app/e/${slug}`

    // Store venue details from Google Maps if selected
    if (selectedPlaceId) {
      eventInsert.venue_place_id = selectedPlaceId
      eventInsert.venue_address = selectedVenueAddress || complexAddress || newLocation
      eventInsert.venue_lat = selectedLat
      eventInsert.venue_lng = selectedLng
    }

    const { data: ev, error } = await sb.from('events').insert(eventInsert).select().single()

    if (error) {
      toast.error(error.message)
      setCreating(false)
      return
    }

    const newEventId = (ev as any).id

    // Add to user_roles FIRST — event_admins RLS depends on user_event_ids() which reads user_roles
    await sb.from('user_roles').upsert(
      {
        user_id: user?.id,
        role: 'admin',
        display_name: userRole?.display_name ?? 'Admin',
        event_id: newEventId,
        is_active: true,
      },
      { onConflict: 'user_id,event_id,role' }
    )

    // Add creator as owner admin (now passes RLS because user_roles row exists)
    await sb.from('event_admins').insert({ event_id: newEventId, user_id: user?.id, role: 'owner' })

    // Create the primary complex
    await sb.from('complexes').insert({
      event_id: newEventId,
      name: complexName.trim(),
      address: complexAddress.trim() || null,
    })

    // Seed default scheduling rules for the new event
    await seedDefaultRules(newEventId, sb)

    // ── Copy from source event if selected ──────────────────────────────────
    if (copySourceId) {
      const jobs: (() => Promise<void>)[] = []

      if (copySettings) {
        jobs.push(async () => {
          const { data } = await sb
            .from('fields')
            .select(
              'name,number,division,map_x,map_y,map_w,map_h,map_rotation,map_color,map_opacity,map_shape'
            )
            .eq('event_id', copySourceId)
          if (data?.length)
            await sb.from('fields').insert(data.map((f) => ({ ...f, event_id: newEventId })))
        })
        jobs.push(async () => {
          const { data } = await sb
            .from('event_rules')
            .select('category,rule_key,value,value_type,label,description')
            .eq('event_id', copySourceId)
          if (data?.length)
            await sb.from('event_rules').insert(data.map((r) => ({ ...r, event_id: newEventId })))
        })
      }

      if (copyRefsVols) {
        jobs.push(async () => {
          const { data } = await sb
            .from('referees')
            .select('name,grade_level,phone,email')
            .eq('event_id', copySourceId)
          if (data?.length)
            await sb
              .from('referees')
              .insert(data.map((r) => ({ ...r, event_id: newEventId, checked_in: false })))
        })
        jobs.push(async () => {
          const { data } = await sb
            .from('volunteers')
            .select('name,role,phone')
            .eq('event_id', copySourceId)
          if (data?.length)
            await sb
              .from('volunteers')
              .insert(data.map((v) => ({ ...v, event_id: newEventId, checked_in: false })))
        })
      }

      if (copyTeams) {
        jobs.push(async () => {
          const { data } = await sb
            .from('teams')
            .select('name,division,age_group,coach_name,coach_email,program_id')
            .eq('event_id', copySourceId)
          if (data?.length)
            await sb.from('teams').insert(data.map((t) => ({ ...t, event_id: newEventId })))
        })
      }

      if (copyComplexes) {
        jobs.push(async () => {
          const { data: srcComplexes } = await sb
            .from('complexes')
            .select('*')
            .eq('event_id', copySourceId)
          for (const c of srcComplexes ?? []) {
            const { data: newC } = await sb
              .from('complexes')
              .insert({
                event_id: newEventId,
                name: c.name,
                address: c.address,
                lat: c.lat,
                lng: c.lng,
                lightning_radius_miles: c.lightning_radius_miles,
              })
              .select()
              .single()
            if (newC) {
              const { data: srcFields } = await sb.from('fields').select('*').eq('complex_id', c.id)
              if (srcFields?.length) {
                await sb.from('fields').insert(
                  srcFields.map((f) => ({
                    event_id: newEventId,
                    name: f.name,
                    number: f.number,
                    division: f.division,
                    complex_id: (newC as any).id,
                  }))
                )
              }
            }
          }
        })
      }

      await Promise.all(jobs.map((j) => j()))

      const what = [
        copySettings && 'fields & settings',
        copyRefsVols && 'refs & volunteers',
        copyTeams && 'teams',
        copyComplexes && 'complexes',
      ]
        .filter(Boolean)
        .join(', ')
      toast.success(`${newName} created with ${what} copied!`)
    } else {
      toast.success(`${newName} created!`)
    }

    setCreating(false)
    resetForm()
    onSelectEvent(newEventId, true)
  }

  function copyCode(id: number, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
    toast.success('Event code copied')
  }

  async function archiveEvent(e: React.MouseEvent, eventId: number) {
    e.stopPropagation()
    const sb = createClient()
    const { error } = await sb.from('events').update({ status: 'archived' }).eq('id', eventId)
    if (error) {
      toast.error('Failed to archive event')
      return
    }
    toast.success('Event archived')
    loadEvents()
  }

  async function unarchiveEvent(e: React.MouseEvent, eventId: number) {
    e.stopPropagation()
    const sb = createClient()
    const { error } = await sb.from('events').update({ status: 'draft' }).eq('id', eventId)
    if (error) {
      toast.error('Failed to unarchive event')
      return
    }
    toast.success('Event restored')
    loadEvents()
  }

  function handleVenueSelect(venue: {
    name: string
    address: string
    lat: number
    lng: number
    place_id: string
  }) {
    setSelectedPlaceId(venue.place_id)
    setSelectedLat(venue.lat)
    setSelectedLng(venue.lng)
    setSelectedVenueAddress(venue.address)
    setNewLocation(venue.address || venue.name)
    setComplexName(venue.name)
    setComplexAddress(venue.address)
  }

  function formatDate(d: string) {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const inp =
    'w-full bg-[#030d20] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors'
  const lbl =
    'font-cond text-[9px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#020810' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#1a2d50]">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-sm bg-red" />
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
            <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
            <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
            <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.35" />
          </svg>
          <span className="font-cond text-[20px] font-black tracking-[.15em] text-white">
            LEAGUEOPS
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onSwitchToProgram && (
            <button
              onClick={onSwitchToProgram}
              className="font-cond text-[11px] font-bold text-blue-300 hover:text-white border border-[#1a2d50] rounded px-3 py-1.5 transition-colors"
            >
              PROGRAM VIEW
            </button>
          )}
          <span className="font-cond text-[12px] text-[#5a6e9a]">{userRole?.display_name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 font-cond text-[11px] text-[#5a6e9a] hover:text-white transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        {/* Title row */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-cond text-[28px] font-black tracking-[.06em] text-white mb-1">
              MY EVENTS
            </div>
            <div className="font-cond text-[13px] text-[#5a6e9a]">
              Select an event to manage, or create a new one
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowArchived((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 font-cond text-[11px] font-black tracking-[.08em] px-3 py-2 rounded-lg border transition-colors',
                showArchived
                  ? 'border-blue-500/40 bg-blue-900/20 text-blue-400'
                  : 'border-[#1a2d50] text-[#5a6e9a] hover:text-white hover:border-[#2a3d60]'
              )}
            >
              {showArchived ? <EyeOff size={12} /> : <Eye size={12} />}
              {showArchived ? 'HIDE ARCHIVED' : 'SHOW ARCHIVED'}
            </button>
            <button
              onClick={() => {
                setShowForm((s) => !s)
                setStep(1)
              }}
              className="flex items-center gap-2 font-cond font-black text-[13px] tracking-[.1em] px-5 py-2.5 rounded-xl bg-red hover:bg-red/80 text-white transition-colors"
            >
              <Plus size={15} /> CREATE EVENT
            </button>
          </div>
        </div>

        {/* ── Create wizard ─────────────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-[#081428] border border-[#1a2d50] rounded-2xl p-6 mb-6">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-6">
              {[
                { n: 1, label: 'Event Details' },
                { n: 2, label: 'Copy Options' },
              ].map(({ n, label }) => (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center font-cond text-[11px] font-black',
                      step === n
                        ? 'bg-red text-white'
                        : step > n
                          ? 'bg-green-700 text-white'
                          : 'bg-[#1a2d50] text-[#5a6e9a]'
                    )}
                  >
                    {step > n ? '✓' : n}
                  </div>
                  <span
                    className={cn(
                      'font-cond text-[11px] font-black tracking-wide',
                      step === n ? 'text-white' : 'text-[#5a6e9a]'
                    )}
                  >
                    {label.toUpperCase()}
                  </span>
                  {n < 2 && <ChevronRight size={12} className="text-[#1a2d50]" />}
                </div>
              ))}
            </div>

            {/* ── Step 1: Event details ── */}
            {step === 1 && (
              <>
                <div className="font-cond text-[14px] font-black tracking-[.1em] text-white mb-5">
                  NEW EVENT
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={lbl}>Event Name *</label>
                    <input
                      className={inp}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Knights Lacrosse Summer Invitational 2025"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={lbl}>Sport</label>
                    <select
                      className={inp}
                      value={newSport}
                      onChange={(e) => setNewSport(e.target.value)}
                    >
                      {Object.keys(SPORTS_EMOJI).map((s) => (
                        <option key={s} value={s}>
                          {SPORTS_EMOJI[s]} {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Type</label>
                    <select
                      className={inp}
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                    >
                      <option value="tournament">🏆 Tournament</option>
                      <option value="season">📅 Season</option>
                      <option value="clinic">📋 Clinic</option>
                      <option value="league">🏅 League</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Venue / Complex Name *</label>
                    <VenueAutocompleteInput
                      value={newLocation}
                      onLocationChange={(text) => setNewLocation(text)}
                      onVenueSelect={handleVenueSelect}
                      selectedPlaceId={selectedPlaceId}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Start Date *</label>
                    <input
                      type="date"
                      className={inp}
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={lbl}>End Date *</label>
                    <input
                      type="date"
                      className={inp}
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Primary Complex ── */}
                <div className="mt-5 pt-4 border-t border-[#1a2d50]">
                  <div className="font-cond text-[11px] font-black tracking-[.12em] text-[#5a6e9a] uppercase mb-3">
                    Primary Complex *
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className={lbl}>Complex Name *</label>
                      <input
                        className={inp}
                        value={complexName}
                        onChange={(e) => setComplexName(e.target.value)}
                        placeholder="e.g. Riverside Sports Complex"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Address (optional — used for weather)</label>
                      <input
                        className={inp}
                        value={complexAddress}
                        onChange={(e) => setComplexAddress(e.target.value)}
                        placeholder="e.g. 1234 Park Blvd, Jacksonville, FL 32099"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#5a6e9a] mt-1.5">
                    You can add more complexes and fields from Settings → Map after creation.
                  </p>
                </div>

                <div className="flex gap-3 mt-5 pt-4 border-t border-[#1a2d50]">
                  <button
                    onClick={resetForm}
                    className="font-cond text-[12px] text-[#5a6e9a] hover:text-white px-4 py-2 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={goToStep2}
                    className="flex items-center gap-2 font-cond font-black text-[13px] tracking-[.1em] px-6 py-2.5 rounded-xl bg-red hover:bg-red/80 text-white transition-colors ml-auto"
                  >
                    NEXT → COPY OPTIONS
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Copy options ── */}
            {step === 2 && (
              <>
                <div className="font-cond text-[14px] font-black tracking-[.1em] text-white mb-1">
                  COPY FROM AN EXISTING EVENT?
                </div>
                <div className="font-cond text-[11px] text-[#5a6e9a] mb-5">
                  Optionally carry over settings or people from a previous event. Each event is
                  fully independent — changes here won't affect other events.
                </div>

                {/* Source event selector */}
                <div className="mb-5">
                  <label className={lbl}>Copy settings from</label>
                  <div className="space-y-2">
                    {/* Start fresh */}
                    <label
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                        copySourceId === null
                          ? 'border-blue-500/60 bg-blue-900/20'
                          : 'border-[#1a2d50] bg-[#030d20] hover:border-[#2a3d60]'
                      )}
                    >
                      <input
                        type="radio"
                        className="accent-blue-500"
                        checked={copySourceId === null}
                        onChange={() => setCopySourceId(null)}
                      />
                      <div>
                        <div className="font-cond text-[12px] font-black text-white">
                          Start fresh
                        </div>
                        <div className="font-cond text-[10px] text-[#5a6e9a]">
                          Blank event with no pre-loaded data
                        </div>
                      </div>
                    </label>

                    {/* Existing events */}
                    {events.map((ev) => (
                      <label
                        key={ev.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                          copySourceId === ev.id
                            ? 'border-blue-500/60 bg-blue-900/20'
                            : 'border-[#1a2d50] bg-[#030d20] hover:border-[#2a3d60]'
                        )}
                      >
                        <input
                          type="radio"
                          className="accent-blue-500"
                          checked={copySourceId === ev.id}
                          onChange={() => setCopySourceId(ev.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-cond text-[12px] font-black text-white truncate">
                            {ev.name}
                          </div>
                          <div className="font-cond text-[10px] text-[#5a6e9a]">
                            {SPORTS_EMOJI[ev.sport] ?? '🏆'} {ev.sport} ·{' '}
                            {formatDate(ev.start_date)}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'font-cond text-[9px] font-black tracking-wider px-2 py-0.5 rounded flex-shrink-0',
                            ev.status === 'active'
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-[#1a2d50] text-[#5a6e9a]'
                          )}
                        >
                          {ev.status.toUpperCase()}
                        </div>
                      </label>
                    ))}

                    {events.length === 0 && (
                      <div className="font-cond text-[11px] text-[#5a6e9a] italic px-3">
                        No previous events to copy from
                      </div>
                    )}
                  </div>
                </div>

                {/* What to copy — only shown when a source is selected */}
                {copySourceId !== null && (
                  <div className="mb-5 p-4 rounded-xl border border-[#1a2d50] bg-[#030d20]">
                    <div className={lbl}>What to copy</div>
                    <div className="space-y-3 mt-2">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="accent-blue-500 mt-0.5 flex-shrink-0"
                          checked={copySettings}
                          onChange={(e) => setCopySettings(e.target.checked)}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Settings size={12} className="text-blue-400" />
                            <span className="font-cond text-[12px] font-black text-white">
                              Fields & Settings
                            </span>
                          </div>
                          <div className="font-cond text-[10px] text-[#5a6e9a] mt-0.5">
                            Copies all fields (names, numbers, map positions) and configured rules
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="accent-blue-500 mt-0.5 flex-shrink-0"
                          checked={copyRefsVols}
                          onChange={(e) => setCopyRefsVols(e.target.checked)}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Users size={12} className="text-blue-400" />
                            <span className="font-cond text-[12px] font-black text-white">
                              Referees & Volunteers
                            </span>
                          </div>
                          <div className="font-cond text-[10px] text-[#5a6e9a] mt-0.5">
                            Copies the ref pool and volunteer roster — check-in status starts fresh
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="accent-blue-500 mt-0.5 flex-shrink-0"
                          checked={copyTeams}
                          onChange={(e) => setCopyTeams(e.target.checked)}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Users size={12} className="text-blue-400" />
                            <span className="font-cond text-[12px] font-black text-white">
                              Teams
                            </span>
                          </div>
                          <div className="font-cond text-[10px] text-[#5a6e9a] mt-0.5">
                            Copies team names and divisions
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="accent-blue-500 mt-0.5 flex-shrink-0"
                          checked={copyComplexes}
                          onChange={(e) => setCopyComplexes(e.target.checked)}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-blue-400" />
                            <span className="font-cond text-[12px] font-black text-white">
                              Complexes & Fields
                            </span>
                          </div>
                          <div className="font-cond text-[10px] text-[#5a6e9a] mt-0.5">
                            Copies all complexes and their fields (in addition to the primary
                            complex above)
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-[#1a2d50]">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 font-cond text-[12px] text-[#5a6e9a] hover:text-white px-4 py-2 transition-colors"
                  >
                    <ArrowLeft size={13} /> BACK
                  </button>
                  <button
                    onClick={createEvent}
                    disabled={creating}
                    className="flex items-center gap-2 font-cond font-black text-[13px] tracking-[.1em] px-6 py-2.5 rounded-xl bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50 ml-auto"
                  >
                    {creating
                      ? 'CREATING...'
                      : copySourceId
                        ? 'CREATE & COPY →'
                        : 'CREATE & ENTER →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Events grid */}
        {loading ? (
          <div className="text-center py-20 text-[#5a6e9a] font-cond">LOADING EVENTS...</div>
        ) : events.length === 0 && !showForm ? (
          <div className="text-center py-20">
            <Trophy size={48} className="mx-auto mb-4" style={{ color: '#1a2d50' }} />
            <div className="font-cond text-[18px] font-black text-white mb-2">NO EVENTS YET</div>
            <div className="font-cond text-[13px] text-[#5a6e9a]">
              Click CREATE EVENT to get started
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {events
              .filter((ev) => showArchived || ev.status !== 'archived')
              .map((ev) => {
                const sport = SPORTS_EMOJI[ev.sport] ?? '🏆'
                const color = ev.primary_color ?? '#0B3D91'
                const isLive = ev.status === 'active'
                const isArchived = ev.status === 'archived'

                return (
                  <div
                    key={ev.id}
                    className={cn(
                      'group relative rounded-2xl overflow-hidden border transition-all cursor-pointer',
                      isArchived ? 'opacity-50 hover:opacity-80' : 'hover:border-blue-400/60'
                    )}
                    style={{ background: '#081428', borderColor: isLive ? '#22c55e40' : '#1a2d50' }}
                    onClick={() => onSelectEvent(ev.id)}
                  >
                    <div className="h-1.5" style={{ background: color }} />

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {ev.logo_url ? (
                            <img
                              src={ev.logo_url}
                              alt=""
                              className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                              style={{ background: color + '30', border: `1px solid ${color}40` }}
                            >
                              {sport}
                            </div>
                          )}
                          <div>
                            <div className="font-cond text-[16px] font-black text-white leading-tight">
                              {ev.name}
                            </div>
                            <div className="font-cond text-[10px] text-[#5a6e9a] capitalize mt-0.5">
                              {ev.sport} {ev.event_type}
                            </div>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'font-cond text-[9px] font-black tracking-[.15em] px-2 py-1 rounded flex-shrink-0',
                            isLive
                              ? 'bg-green-900/40 text-green-400'
                              : isArchived
                                ? 'bg-amber-900/30 text-amber-500'
                                : ev.status === 'completed'
                                  ? 'bg-gray-800 text-gray-500'
                                  : 'bg-[#0d1a2e] text-[#5a6e9a]'
                          )}
                        >
                          {ev.status.toUpperCase()}
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 font-cond text-[11px] text-[#5a6e9a]">
                          <MapPin size={11} className="flex-shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                        <div className="flex items-center gap-2 font-cond text-[11px] text-[#5a6e9a]">
                          <Calendar size={11} className="flex-shrink-0" />
                          <span>
                            {formatDate(ev.start_date)}
                            {ev.end_date && ev.end_date !== ev.start_date
                              ? ` – ${formatDate(ev.end_date)}`
                              : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#1a2d50]">
                        {ev.event_code && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyCode(ev.id, ev.event_code!)
                            }}
                            className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#5a6e9a] hover:text-white transition-colors"
                            title="Copy event code"
                          >
                            {copiedCode === ev.id ? (
                              <>
                                <CheckCircle size={11} className="text-green-400" />{' '}
                                <span className="text-green-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} /> {ev.event_code}
                              </>
                            )}
                          </button>
                        )}
                        {isArchived ? (
                          <button
                            onClick={(e) => unarchiveEvent(e, ev.id)}
                            className="flex items-center gap-1.5 font-cond text-[10px] font-black tracking-[.08em] text-amber-500 hover:text-amber-400 transition-colors"
                            title="Unarchive event"
                          >
                            <ArchiveRestore size={12} /> UNARCHIVE
                          </button>
                        ) : (
                          <button
                            onClick={(e) => archiveEvent(e, ev.id)}
                            className="flex items-center gap-1.5 font-cond text-[10px] font-black tracking-[.08em] text-[#5a6e9a] hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Archive event"
                          >
                            <Archive size={12} /> ARCHIVE
                          </button>
                        )}
                        <div className="flex items-center gap-1.5 font-cond text-[11px] font-black tracking-[.08em] text-[#5a6e9a] group-hover:text-white transition-colors ml-auto">
                          OPEN{' '}
                          <ChevronRight
                            size={13}
                            className="group-hover:translate-x-0.5 transition-transform"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
