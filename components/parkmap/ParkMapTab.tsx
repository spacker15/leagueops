'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/supabase/client'
import { Btn } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Upload, X, MapPin, Layers, Map, Image as ImageIcon, ExternalLink, Save } from 'lucide-react'

type MapView = 'overlay' | 'satellite' | 'photo'

interface ParkSettings {
  park_photo_url: string | null
  google_maps_url: string | null
  google_maps_embed: string | null
  park_lat: number | null
  park_lng: number | null
  park_name: string | null
}

export function ParkMapTab() {
  const { state, updateFieldMap, updateFieldName, addField } = useApp()
  const canvasRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const dragRef    = useRef<{ fieldId: number; ox: number; oy: number } | null>(null)

  const [selected, setSelected]   = useState<number | null>(null)
  const [view, setView]           = useState<MapView>('overlay')
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)

  // Park settings
  const [parkSettings, setParkSettings] = useState<ParkSettings>({
    park_photo_url: null, google_maps_url: null, google_maps_embed: null,
    park_lat: null, park_lng: null, park_name: null,
  })
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null)
  const [photoFile, setPhotoFile]         = useState<File | null>(null)
  const [mapsInput, setMapsInput]         = useState('')
  const [parkName, setParkName]           = useState('')
  const [embedInput, setEmbedInput]       = useState('')

  useEffect(() => { loadParkSettings() }, [])

  async function loadParkSettings() {
    const sb = createClient()
    const { data } = await sb.from('events').select('park_photo_url, google_maps_url, google_maps_embed, park_lat, park_lng, park_name').eq('id', 1).single()
    if (data) {
      const d = data as any
      setParkSettings(d)
      setPhotoPreview(d.park_photo_url ?? null)
      setMapsInput(d.google_maps_url ?? '')
      setEmbedInput(d.google_maps_embed ?? '')
      setParkName(d.park_name ?? '')
    }
  }

  // Extract embed src from a Google Maps share/embed snippet
  function parseGoogleMapsInput(input: string): { url: string; embed: string | null } {
    const trimmed = input.trim()
    // If it's already an iframe, extract src
    const srcMatch = trimmed.match(/src="([^"]+)"/)
    if (srcMatch) return { url: srcMatch[1], embed: trimmed }
    // If it's a maps URL, convert to embed
    if (trimmed.includes('google.com/maps')) {
      // Try to build an embed from a place URL
      const embedSrc = trimmed.includes('/embed')
        ? trimmed
        : trimmed.replace('https://www.google.com/maps/', 'https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyqxx&q=').split('?')[0]
      return { url: trimmed, embed: null }
    }
    return { url: trimmed, embed: null }
  }

  // Extract lat/lng from Google Maps URL
  function extractLatLng(url: string): { lat: number | null; lng: number | null } {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
    return { lat: null, lng: null }
  }

  function handlePhotoFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10MB'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = e => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function saveSettings() {
    setSaving(true)
    const sb = createClient()
    let finalPhotoUrl = parkSettings.park_photo_url

    if (photoFile) {
      setUploading(true)
      const ext  = photoFile.name.split('.').pop() ?? 'jpg'
      const path = `events/1/park-photo.${ext}`
      const { error: upErr } = await sb.storage.from('program-assets')
        .upload(path, photoFile, { upsert: true, contentType: photoFile.type })
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`)
        setSaving(false); setUploading(false); return
      }
      const { data: urlData } = sb.storage.from('program-assets').getPublicUrl(path)
      finalPhotoUrl = urlData.publicUrl
      setPhotoFile(null)
      setUploading(false)
    }

    const parsed     = mapsInput ? parseGoogleMapsInput(mapsInput) : { url: null, embed: null }
    const latLng     = mapsInput ? extractLatLng(mapsInput) : { lat: null, lng: null }
    const finalEmbed = embedInput || parsed.embed

    const { error } = await sb.from('events').update({
      park_photo_url:   finalPhotoUrl,
      google_maps_url:  parsed.url || mapsInput || null,
      google_maps_embed: finalEmbed || null,
      park_lat:         latLng.lat,
      park_lng:         latLng.lng,
      park_name:        parkName || null,
    }).eq('id', 1)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Park map settings saved')
      setParkSettings(prev => ({ ...prev, park_photo_url: finalPhotoUrl, google_maps_url: mapsInput, google_maps_embed: finalEmbed ?? null }))
      setShowSettings(false)
    }
    setSaving(false)
  }

  // Drag logic
  function onMouseDown(e: React.MouseEvent, fieldId: number) {
    e.preventDefault()
    const field = state.fields.find(f => f.id === fieldId)
    if (!field) return
    dragRef.current = { fieldId, ox: e.clientX - field.map_x, oy: e.clientY - field.map_y }
    setSelected(fieldId)
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current || !canvasRef.current) return
      const rect  = canvasRef.current.getBoundingClientRect()
      const field = state.fields.find(f => f.id === dragRef.current!.fieldId)
      if (!field) return
      const x = Math.max(0, Math.min(rect.width  - field.map_w, e.clientX - rect.left - (dragRef.current.ox - field.map_x)))
      const y = Math.max(0, Math.min(rect.height - field.map_h, e.clientY - rect.top  - (dragRef.current.oy - field.map_y)))
      updateFieldMap(field.id, Math.round(x), Math.round(y))
    }
    function onMouseUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [state.fields, updateFieldMap])

  async function handleRename(fieldId: number) {
    const field = state.fields.find(f => f.id === fieldId)
    const name  = prompt('Field name:', field?.name ?? '')
    if (name?.trim()) await updateFieldName(fieldId, name.trim())
  }

  async function handleAddField() {
    const name = prompt('New field name (e.g. Field 7):')
    if (!name?.trim()) return
    const num = name.trim().replace(/[^0-9A-Za-z]/g, '')
    await addField(name.trim(), num)
  }

  const fieldGameMap: Record<number, string> = {}
  state.games.filter(g => ['Live','Starting','Halftime'].includes(g.status)).forEach(g => {
    fieldGameMap[g.field_id] = `${g.home_team?.name ?? '?'} vs ${g.away_team?.name ?? '?'}`
  })

  const hasPhoto  = !!photoPreview
  const hasMaps   = !!(parkSettings.google_maps_embed || mapsInput)
  const embedSrc  = parkSettings.google_maps_embed
    ? (parkSettings.google_maps_embed.includes('src=')
        ? parkSettings.google_maps_embed.match(/src="([^"]+)"/)?.[1]
        : parkSettings.google_maps_embed)
    : null

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">PARK MAP</span>

        {/* View toggle */}
        <div className="flex rounded overflow-hidden border border-border">
          {([
            { id: 'overlay',   label: '⊞ Overlay',   icon: <Layers size={11} /> },
            { id: 'photo',     label: '📷 Photo',     icon: <ImageIcon size={11} />, disabled: !hasPhoto },
            { id: 'satellite', label: '🗺 Google Maps', icon: <Map size={11} />,     disabled: !hasMaps },
          ] as { id: MapView; label: string; icon: React.ReactNode; disabled?: boolean }[]).map(v => (
            <button key={v.id}
              onClick={() => !v.disabled && setView(v.id)}
              title={v.disabled ? 'Set this up in Map Settings' : undefined}
              className={cn(
                'flex items-center gap-1.5 font-cond text-[11px] font-bold px-3 py-1.5 transition-colors',
                view === v.id ? 'bg-navy text-white' : 'bg-surface-card text-muted hover:text-white',
                v.disabled && 'opacity-40 cursor-not-allowed'
              )}>
              {v.icon} <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        <Btn size="sm" variant="primary" onClick={handleAddField}>+ FIELD</Btn>
        <button onClick={() => setShowSettings(s => !s)}
          className={cn('flex items-center gap-1.5 font-cond text-[11px] font-bold px-3 py-1.5 rounded border transition-colors',
            showSettings ? 'bg-navy border-blue-400 text-white' : 'bg-surface-card border-border text-muted hover:text-white'
          )}>
          <MapPin size={11} /> MAP SETTINGS
        </button>

        {parkSettings.google_maps_url && (
          <a href={parkSettings.google_maps_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-cond text-[11px] text-blue-300 hover:text-white transition-colors ml-auto">
            <ExternalLink size={11} /> Open in Google Maps
          </a>
        )}

        <span className="font-cond text-[10px] text-muted">
          DRAG TO REPOSITION · DBL-CLICK TO RENAME
        </span>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-surface-card border border-border rounded-xl p-5 mb-4">
          <div className="font-cond font-black text-[13px] tracking-wide mb-4">MAP SETTINGS</div>
          <div className="grid grid-cols-2 gap-5">

            {/* Photo upload */}
            <div>
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                PARK / COMPLEX PHOTO
              </div>
              {photoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border mb-2" style={{ height: 160 }}>
                  <img src={photoPreview} alt="Park" className="w-full h-full object-cover" />
                  <button onClick={() => { setPhotoPreview(null); setPhotoFile(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red rounded-full flex items-center justify-center transition-colors">
                    <X size={13} className="text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-40 rounded-lg border-2 border-dashed border-border hover:border-blue-400 flex flex-col items-center justify-center gap-2 transition-colors bg-white/5 mb-2">
                  <Upload size={22} className="text-muted" />
                  <span className="font-cond text-[10px] text-muted">Upload aerial photo or map image</span>
                  <span className="font-cond text-[9px] text-muted">JPG, PNG · max 10MB</span>
                </button>
              )}
              <button onClick={() => fileRef.current?.click()}
                className="font-cond text-[11px] font-bold px-3 py-1.5 rounded border border-border text-muted hover:text-white transition-colors">
                {photoPreview ? 'CHANGE PHOTO' : 'CHOOSE FILE'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f) }} />
              {photoFile && (
                <div className="font-cond text-[10px] text-blue-300 mt-1">✓ {photoFile.name} — save to upload</div>
              )}
            </div>

            {/* Google Maps */}
            <div>
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                GOOGLE MAPS
              </div>

              <div className="mb-3">
                <label className="font-cond text-[10px] text-muted block mb-1">Park / Complex Name</label>
                <input className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[12px] outline-none focus:border-blue-400"
                  value={parkName} onChange={e => setParkName(e.target.value)}
                  placeholder="e.g. Riverside Sports Complex" />
              </div>

              <div className="mb-3">
                <label className="font-cond text-[10px] text-muted block mb-1">Google Maps URL</label>
                <input className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[12px] outline-none focus:border-blue-400"
                  value={mapsInput} onChange={e => setMapsInput(e.target.value)}
                  placeholder="Paste Google Maps share link..." />
              </div>

              <div className="mb-3">
                <label className="font-cond text-[10px] text-muted block mb-1 flex justify-between">
                  <span>Google Maps Embed Code (optional)</span>
                  <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer"
                    className="text-blue-300 hover:text-white text-[9px]">Get from Google Maps →</a>
                </label>
                <textarea className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[11px] outline-none focus:border-blue-400 resize-y min-h-[70px] font-mono"
                  value={embedInput} onChange={e => setEmbedInput(e.target.value)}
                  placeholder='<iframe src="https://www.google.com/maps/embed?..." ...' />
              </div>

              <div className="bg-navy/30 rounded-lg p-3 text-[10px] font-cond text-muted leading-relaxed">
                <div className="text-blue-300 font-bold mb-1">HOW TO GET EMBED CODE</div>
                1. Open Google Maps → find your park<br />
                2. Click Share → Embed a map<br />
                3. Copy the &lt;iframe&gt; code and paste above
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
            <button onClick={() => setShowSettings(false)}
              className="font-cond text-[12px] text-muted hover:text-white px-4 py-2 transition-colors">
              CANCEL
            </button>
            <button onClick={saveSettings} disabled={saving || uploading}
              className="flex items-center gap-2 font-cond font-black text-[12px] tracking-wide bg-navy hover:bg-navy-light text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50">
              <Save size={13} />
              {uploading ? 'UPLOADING...' : saving ? 'SAVING...' : 'SAVE SETTINGS'}
            </button>
          </div>
        </div>
      )}

      {/* ── MAP CANVAS ── */}
      <div ref={canvasRef}
        className="relative rounded-xl overflow-hidden select-none"
        style={{ height: 540, border: '1px solid #2a4080' }}>

        {/* ── Background: Overlay (default green field grid) ── */}
        {view === 'overlay' && (
          <>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1f0a 0%, #061406 100%)' }} />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.07 }}>
              {Array.from({ length: 25 }, (_, i) => (
                <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={540} stroke="#7bb8ff" strokeWidth={0.5} />
              ))}
              {Array.from({ length: 14 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 40} x2={1000} y2={i * 40} stroke="#7bb8ff" strokeWidth={0.5} />
              ))}
            </svg>
          </>
        )}

        {/* ── Background: Park Photo ── */}
        {view === 'photo' && photoPreview && (
          <img src={photoPreview} alt="Park" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {view === 'photo' && !photoPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/30">
            <ImageIcon size={40} className="text-muted" />
            <div className="font-cond font-bold text-muted">No park photo uploaded</div>
            <button onClick={() => setShowSettings(true)}
              className="font-cond text-[12px] font-bold text-blue-300 hover:text-white">
              Open Map Settings →
            </button>
          </div>
        )}

        {/* ── Background: Google Maps embed ── */}
        {view === 'satellite' && embedSrc && (
          <iframe src={embedSrc} className="absolute inset-0 w-full h-full border-0" allowFullScreen loading="lazy"
            referrerPolicy="no-referrer-when-downgrade" />
        )}
        {view === 'satellite' && !embedSrc && parkSettings.google_maps_url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/30">
            <Map size={40} className="text-muted" />
            <div className="font-cond font-bold text-muted">Add an embed code in Map Settings to show the map inline</div>
            <a href={parkSettings.google_maps_url} target="_blank" rel="noopener noreferrer"
              className="font-cond text-[12px] font-bold text-blue-300 hover:text-white flex items-center gap-1.5">
              <ExternalLink size={12} /> Open in Google Maps
            </a>
          </div>
        )}
        {view === 'satellite' && !embedSrc && !parkSettings.google_maps_url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/30">
            <Map size={40} className="text-muted" />
            <div className="font-cond font-bold text-muted">No Google Maps link configured</div>
            <button onClick={() => setShowSettings(true)}
              className="font-cond text-[12px] font-bold text-blue-300 hover:text-white">
              Open Map Settings →
            </button>
          </div>
        )}

        {/* ── Field overlays (shown on all views) ── */}
        {state.fields.map(field => {
          const isSelected = selected === field.id
          const activeGame = fieldGameMap[field.id]
          const showOnPhoto = view === 'photo' || view === 'overlay'
          const showOnMaps  = view === 'satellite'

          return (
            <div key={field.id}
              style={{ position: 'absolute', left: field.map_x, top: field.map_y, width: field.map_w, height: field.map_h, cursor: 'move' }}
              className={cn(
                'rounded-md border-2 flex flex-col items-center justify-center transition-all',
                view === 'satellite'
                  ? isSelected ? 'border-yellow-400 bg-yellow-900/60' : activeGame ? 'border-green-400/90 bg-green-900/60' : 'border-white/70 bg-black/50'
                  : isSelected ? 'border-blue-400 bg-green-900/50' : activeGame ? 'border-green-500/70 bg-green-900/40' : 'border-blue-400/40 bg-green-900/30',
              )}
              onMouseDown={e => onMouseDown(e, field.id)}
              onDoubleClick={() => handleRename(field.id)}
              onClick={() => setSelected(isSelected ? null : field.id)}
            >
              <div className={cn('font-cond text-2xl font-black leading-none',
                view === 'satellite' ? 'text-white/80' : 'text-white/30'
              )}>{field.number}</div>
              <div className={cn('font-cond font-black text-[12px] text-center px-1',
                view === 'satellite' ? 'text-white' : 'text-white'
              )}>{field.name}</div>
              {activeGame && (
                <div className="font-cond text-[9px] text-green-300 text-center px-1 mt-0.5 truncate w-full">
                  {activeGame}
                </div>
              )}
              {isSelected && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400" />
              )}
            </div>
          )
        })}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex gap-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
          {[
            { color: 'border-green-500/70 bg-green-900/40', label: 'ACTIVE' },
            { color: 'border-blue-400/40 bg-green-900/30', label: 'AVAILABLE' },
            { color: 'border-blue-400 bg-green-900/50',    label: 'SELECTED' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-[10px] font-cond font-bold">
              <div className={cn('w-3 h-3 rounded-sm border-2', l.color)} />
              <span className="text-muted">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Park name badge */}
        {parkSettings.park_name && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <MapPin size={11} className="text-blue-300" />
            <span className="font-cond font-bold text-[11px] text-white">{parkSettings.park_name}</span>
          </div>
        )}
      </div>

      {/* Selected field toolbar */}
      {selected && (
        <div className="mt-3 bg-surface-card border border-border rounded-xl p-3 flex items-center gap-4">
          <span className="font-cond font-black text-[14px] text-white">
            {state.fields.find(f => f.id === selected)?.name}
          </span>
          <span className="font-cond text-[11px] text-muted">
            ({state.fields.find(f => f.id === selected)?.map_x}, {state.fields.find(f => f.id === selected)?.map_y})
          </span>
          <Btn size="sm" variant="ghost" onClick={() => handleRename(selected)}>RENAME</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setSelected(null)}>DESELECT</Btn>
        </div>
      )}
    </div>
  )
}
