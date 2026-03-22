'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Plus, LogOut, Calendar, MapPin, ChevronRight, Trophy, Copy, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

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
  onSelectEvent: (eventId: number) => void
}

const SPORTS_EMOJI: Record<string, string> = {
  Lacrosse: '🥍', Soccer: '⚽', Basketball: '🏀', Baseball: '⚾',
  Softball: '🥎', Volleyball: '🏐', Football: '🏈', Hockey: '🏒',
  Tennis: '🎾', Swimming: '🏊', Track: '🏃', Wrestling: '🤼', Other: '🏆',
}

const TYPE_COLORS: Record<string, string> = {
  tournament: '#0B3D91', season: '#065f46', clinic: '#78350f', league: '#4c1d95',
}

export function EventPicker({ onSelectEvent }: Props) {
  const { userRole, signOut } = useAuth()
  const [events, setEvents]       = useState<EventSummary[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [copiedCode, setCopiedCode] = useState<number | null>(null)

  // New event form
  const [showForm, setShowForm]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newSport, setNewSport]   = useState('Lacrosse')
  const [newType, setNewType]     = useState('tournament')
  const [newLocation, setNewLocation] = useState('')
  const [newStart, setNewStart]   = useState('')
  const [newEnd, setNewEnd]       = useState('')

  // Complex step
  const [complexName, setComplexName]       = useState('')
  const [complexAddress, setComplexAddress] = useState('')

  // Copy-from-previous step
  const [showCopySection, setShowCopySection] = useState(false)
  const [copyFromId, setCopyFromId]           = useState<number | ''>('')
  const [copyRefs, setCopyRefs]               = useState(true)
  const [copyTeams, setCopyTeams]             = useState(false)
  const [copyComplexes, setCopyComplexes]     = useState(false)

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    const sb = createClient()
    setLoading(true)

    // Load events this user is admin of
    const { data: adminRows } = await sb
      .from('event_admins')
      .select('event_id')
      .eq('user_id', (await sb.auth.getUser()).data.user?.id ?? '')

    const eventIds = (adminRows ?? []).map((r: any) => r.event_id)

    if (eventIds.length === 0) {
      // Fallback — try loading event 1 directly for legacy setup
      const { data } = await sb.from('events').select('id,name,sport,event_type,location,start_date,end_date,status,logo_url,event_code,slug,primary_color').eq('id', 1).single()
      if (data) setEvents([data as EventSummary])
    } else {
      const { data } = await sb
        .from('events')
        .select('id,name,sport,event_type,location,start_date,end_date,status,logo_url,event_code,slug,primary_color')
        .in('id', eventIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setEvents((data as EventSummary[]) ?? [])
    }
    setLoading(false)
  }

  async function createEvent() {
    if (!newName || !newStart || !newEnd || !newLocation) {
      toast.error('Name, location, and dates required'); return
    }
    if (!complexName.trim()) {
      toast.error('Complex name is required'); return
    }
    setCreating(true)
    const sb   = createClient()
    const user = (await sb.auth.getUser()).data.user

    // Generate slug from name
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + new Date().getFullYear()

    const { data: ev, error } = await sb.from('events').insert({
      name:       newName,
      sport:      newSport,
      event_type: newType,
      location:   newLocation,
      start_date: newStart,
      end_date:   newEnd,
      status:     'draft',
      slug,
      owner_id:   user?.id,
      is_active:  true,
      event_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      primary_color:   '#0B3D91',
      secondary_color: '#D62828',
    }).select().single()

    if (error) { toast.error(error.message); setCreating(false); return }

    const newEventId = (ev as any).id

    // Add creator as owner admin
    await sb.from('event_admins').insert({
      event_id: newEventId,
      user_id:  user?.id,
      role:     'owner',
    })

    // Add owner to user_roles for this event
    await sb.from('user_roles').upsert({
      user_id:      user?.id,
      role:         'admin',
      display_name: userRole?.display_name ?? 'Admin',
      event_id:     newEventId,
      is_active:    true,
    }, { onConflict: 'user_id,event_id' })

    // Create the primary complex
    await sb.from('complexes').insert({
      event_id: newEventId,
      name:     complexName.trim(),
      address:  complexAddress.trim() || null,
    })

    // Copy from previous event if requested
    if (showCopySection && copyFromId) {
      const src = Number(copyFromId)

      if (copyComplexes) {
        const { data: srcComplexes } = await sb.from('complexes').select('*').eq('event_id', src)
        for (const c of srcComplexes ?? []) {
          const { data: newC } = await sb.from('complexes').insert({
            event_id: newEventId, name: c.name, address: c.address,
            lat: c.lat, lng: c.lng, lightning_radius_miles: c.lightning_radius_miles,
          }).select().single()
          if (newC) {
            const { data: srcFields } = await sb.from('fields').select('*').eq('complex_id', c.id)
            for (const f of srcFields ?? []) {
              await sb.from('fields').insert({
                event_id: newEventId, name: f.name, number: f.number,
                division: f.division, complex_id: (newC as any).id,
              })
            }
          }
        }
      }

      if (copyRefs) {
        const { data: srcRefs } = await sb.from('referees').select('*').eq('event_id', src)
        for (const r of srcRefs ?? []) {
          await sb.from('referees').insert({
            event_id: newEventId, name: r.name, email: r.email,
            phone: r.phone, certification: r.certification,
            checked_in: false,
          })
        }
      }

      if (copyTeams) {
        const { data: srcTeams } = await sb.from('teams').select('*').eq('event_id', src)
        for (const t of srcTeams ?? []) {
          await sb.from('teams').insert({
            event_id: newEventId, name: t.name, division: t.division,
            age_group: t.age_group, coach_name: t.coach_name, coach_email: t.coach_email,
          })
        }
      }
    }

    toast.success(`${newName} created!`)
    setCreating(false)
    setShowForm(false)
    setNewName(''); setNewLocation(''); setNewStart(''); setNewEnd('')
    setComplexName(''); setComplexAddress('')
    setShowCopySection(false); setCopyFromId('')
    await loadEvents()
    onSelectEvent(newEventId)
  }

  function copyCode(id: number, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
    toast.success('Event code copied')
  }

  function formatDate(d: string) {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const inp = 'w-full bg-[#030d20] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors'
  const lbl = 'font-cond text-[9px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#020810' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#1a2d50]">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-sm bg-red" />
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
            <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
            <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
            <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.35"/>
          </svg>
          <span className="font-cond text-[20px] font-black tracking-[.15em] text-white">LEAGUEOPS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-cond text-[12px] text-[#5a6e9a]">{userRole?.display_name}</span>
          <button onClick={signOut} className="flex items-center gap-1.5 font-cond text-[11px] text-[#5a6e9a] hover:text-white transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        {/* Title row */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-cond text-[28px] font-black tracking-[.06em] text-white mb-1">MY EVENTS</div>
            <div className="font-cond text-[13px] text-[#5a6e9a]">Select an event to manage, or create a new one</div>
          </div>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 font-cond font-black text-[13px] tracking-[.1em] px-5 py-2.5 rounded-xl bg-red hover:bg-red/80 text-white transition-colors">
            <Plus size={15} /> CREATE EVENT
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-[#081428] border border-[#1a2d50] rounded-2xl p-6 mb-6">
            <div className="font-cond text-[14px] font-black tracking-[.1em] text-white mb-5">NEW EVENT</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lbl}>Event Name *</label>
                <input className={inp} value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Knights Lacrosse Summer Invitational 2025" autoFocus />
              </div>
              <div>
                <label className={lbl}>Sport</label>
                <select className={inp} value={newSport} onChange={e => setNewSport(e.target.value)}>
                  {Object.keys(SPORTS_EMOJI).map(s => <option key={s} value={s}>{SPORTS_EMOJI[s]} {s}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Type</label>
                <select className={inp} value={newType} onChange={e => setNewType(e.target.value)}>
                  <option value="tournament">🏆 Tournament</option>
                  <option value="season">📅 Season</option>
                  <option value="clinic">📋 Clinic</option>
                  <option value="league">🏅 League</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Location / Venue *</label>
                <input className={inp} value={newLocation} onChange={e => setNewLocation(e.target.value)}
                  placeholder="e.g. Riverside Sports Complex, Jacksonville FL" />
              </div>
              <div>
                <label className={lbl}>Start Date *</label>
                <input type="date" className={inp} value={newStart} onChange={e => setNewStart(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>End Date *</label>
                <input type="date" className={inp} value={newEnd} onChange={e => setNewEnd(e.target.value)} />
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
                  <input className={inp} value={complexName} onChange={e => setComplexName(e.target.value)}
                    placeholder="e.g. Riverside Sports Complex" />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Address (optional — used for weather)</label>
                  <input className={inp} value={complexAddress} onChange={e => setComplexAddress(e.target.value)}
                    placeholder="e.g. 1234 Park Blvd, Jacksonville, FL 32099" />
                </div>
              </div>
              <p className="text-[10px] text-[#5a6e9a] mt-1.5">You can add more complexes and fields from Settings → Map after creation.</p>
            </div>

            {/* ── Copy from previous event ── */}
            <div className="mt-4 border border-[#1a2d50] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCopySection(s => !s)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors">
                <span className="font-cond text-[11px] font-black tracking-[.1em] text-[#5a6e9a] uppercase">
                  Copy from a previous event?
                </span>
                {showCopySection ? <ChevronUp size={14} className="text-[#5a6e9a]" /> : <ChevronDown size={14} className="text-[#5a6e9a]" />}
              </button>
              {showCopySection && (
                <div className="px-4 pb-4 border-t border-[#1a2d50]">
                  <div className="mt-3">
                    <label className={lbl}>Copy from event</label>
                    <select className={inp} value={copyFromId} onChange={e => setCopyFromId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">— Select an event —</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                  </div>
                  {copyFromId && (
                    <div className="mt-3 space-y-2">
                      <div className="font-cond text-[10px] font-black tracking-[.1em] text-[#5a6e9a] uppercase mb-1">What to copy</div>
                      {[
                        { label: 'Referees', value: copyRefs, set: setCopyRefs },
                        { label: 'Teams', value: copyTeams, set: setCopyTeams },
                        { label: 'Complexes & Fields', value: copyComplexes, set: setCopyComplexes },
                      ].map(({ label, value, set }) => (
                        <label key={label} className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input type="checkbox" checked={value} onChange={e => set(e.target.checked)}
                            className="w-3.5 h-3.5 accent-blue-500" />
                          <span className="font-cond text-[12px] text-white">{label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-[#1a2d50]">
              <button onClick={() => setShowForm(false)}
                className="font-cond text-[12px] text-[#5a6e9a] hover:text-white px-4 py-2 transition-colors">
                CANCEL
              </button>
              <button onClick={createEvent} disabled={creating}
                className="flex items-center gap-2 font-cond font-black text-[13px] tracking-[.1em] px-6 py-2.5 rounded-xl bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50">
                {creating ? 'CREATING...' : 'CREATE & ENTER →'}
              </button>
            </div>
          </div>
        )}

        {/* Events grid */}
        {loading ? (
          <div className="text-center py-20 text-[#5a6e9a] font-cond">LOADING EVENTS...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <Trophy size={48} className="mx-auto mb-4" style={{ color: '#1a2d50' }} />
            <div className="font-cond text-[18px] font-black text-white mb-2">NO EVENTS YET</div>
            <div className="font-cond text-[13px] text-[#5a6e9a]">Click CREATE EVENT to get started</div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {events.map(ev => {
              const sport  = SPORTS_EMOJI[ev.sport] ?? '🏆'
              const color  = ev.primary_color ?? '#0B3D91'
              const isLive = ev.status === 'active'

              return (
                <div key={ev.id}
                  className="group relative rounded-2xl overflow-hidden border transition-all hover:border-blue-400/60 cursor-pointer"
                  style={{ background: '#081428', borderColor: isLive ? '#22c55e40' : '#1a2d50' }}
                  onClick={() => onSelectEvent(ev.id)}>

                  {/* Color bar */}
                  <div className="h-1.5" style={{ background: color }} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {ev.logo_url ? (
                          <img src={ev.logo_url} alt="" className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                            style={{ background: color + '30', border: `1px solid ${color}40` }}>
                            {sport}
                          </div>
                        )}
                        <div>
                          <div className="font-cond text-[16px] font-black text-white leading-tight">{ev.name}</div>
                          <div className="font-cond text-[10px] text-[#5a6e9a] capitalize mt-0.5">
                            {ev.sport} {ev.event_type}
                          </div>
                        </div>
                      </div>
                      <div className={cn('font-cond text-[9px] font-black tracking-[.15em] px-2 py-1 rounded flex-shrink-0',
                        isLive ? 'bg-green-900/40 text-green-400' :
                        ev.status === 'completed' ? 'bg-gray-800 text-gray-500' :
                        'bg-[#0d1a2e] text-[#5a6e9a]'
                      )}>{ev.status.toUpperCase()}</div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 font-cond text-[11px] text-[#5a6e9a]">
                        <MapPin size={11} className="flex-shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                      <div className="flex items-center gap-2 font-cond text-[11px] text-[#5a6e9a]">
                        <Calendar size={11} className="flex-shrink-0" />
                        <span>{formatDate(ev.start_date)}{ev.end_date && ev.end_date !== ev.start_date ? ` – ${formatDate(ev.end_date)}` : ''}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#1a2d50]">
                      {/* Event code */}
                      {ev.event_code && (
                        <button
                          onClick={e => { e.stopPropagation(); copyCode(ev.id, ev.event_code!) }}
                          className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#5a6e9a] hover:text-white transition-colors"
                          title="Copy event code">
                          {copiedCode === ev.id
                            ? <><CheckCircle size={11} className="text-green-400" /> <span className="text-green-400">Copied!</span></>
                            : <><Copy size={11} /> {ev.event_code}</>
                          }
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 font-cond text-[11px] font-black tracking-[.08em] text-[#5a6e9a] group-hover:text-white transition-colors ml-auto">
                        OPEN <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
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
