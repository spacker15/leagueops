'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Upload,
  X,
  MapPin,
  Map,
  Image as ImageIcon,
  ExternalLink,
  Save,
  Trash2,
  RotateCw,
  Plus,
} from 'lucide-react'
import type { Field } from '@/types'

type MapView = 'overlay' | 'photo' | 'satellite'
type Handle = 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw' | 'rotate'

const FIELD_COLORS = [
  { label: 'Green', value: '#1a6b1a' },
  { label: 'Teal', value: '#0d6e6e' },
  { label: 'Blue', value: '#1a3a8f' },
  { label: 'Purple', value: '#6b21a8' },
  { label: 'Red', value: '#9b1c1c' },
  { label: 'Orange', value: '#9a3412' },
  { label: 'Yellow', value: '#854d0e' },
  { label: 'White', value: '#2a2a3a' },
]

interface DragState {
  fieldId: number
  handle: Handle
  startX: number // client coords at drag start
  startY: number
  origX: number // field props at drag start
  origY: number
  origW: number
  origH: number
  origRot: number
  centerX: number // field center in canvas coords
  centerY: number
}

export function ParkMapTab() {
  const { state, updateFieldFull, updateFieldName, addField } = useApp()
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [selected, setSelected] = useState<number | null>(null)
  const [view, setView] = useState<MapView>('overlay')
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Park settings
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [mapsUrl, setMapsUrl] = useState('')
  const [embedCode, setEmbedCode] = useState('')
  const [parkName, setParkName] = useState('')
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    loadParkSettings()
  }, [])

  async function loadParkSettings() {
    const sb = createClient()
    const { data } = await sb
      .from('events')
      .select('park_photo_url, google_maps_url, google_maps_embed, park_name')
      .eq('id', 1)
      .single()
    if (data) {
      const d = data as any
      setSavedPhotoUrl(d.park_photo_url ?? null)
      setPhotoPreview(d.park_photo_url ?? null)
      setMapsUrl(d.google_maps_url ?? '')
      setEmbedCode(d.google_maps_embed ?? '')
      setParkName(d.park_name ?? '')
    }
  }

  function handlePhotoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Image files only')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Max 10MB')
      return
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function saveSettings() {
    setSaving(true)
    const sb = createClient()
    let finalPhoto = savedPhotoUrl

    if (photoFile) {
      setUploading(true)
      const ext = photoFile.name.split('.').pop() ?? 'jpg'
      const path = `events/1/park-photo.${ext}`
      const { error } = await sb.storage
        .from('program-assets')
        .upload(path, photoFile, { upsert: true, contentType: photoFile.type })
      if (error) {
        toast.error(`Upload failed: ${error.message}`)
        setSaving(false)
        setUploading(false)
        return
      }
      finalPhoto = sb.storage.from('program-assets').getPublicUrl(path).data.publicUrl
      setSavedPhotoUrl(finalPhoto)
      setPhotoFile(null)
      setUploading(false)
    }

    const { error } = await sb
      .from('events')
      .update({
        park_photo_url: finalPhoto,
        google_maps_url: mapsUrl || null,
        google_maps_embed: embedCode || null,
        park_name: parkName || null,
      })
      .eq('id', 1)

    if (error) toast.error(error.message)
    else {
      toast.success('Map settings saved')
      setShowSettings(false)
    }
    setSaving(false)
  }

  // ── Pointer event handlers ──────────────────────────────────
  function getCanvasRect() {
    return (
      canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 800, height: 540 }
    )
  }

  function onPointerDown(e: React.PointerEvent, fieldId: number, handle: Handle) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const field = state.fields.find((f) => f.id === fieldId)
    if (!field) return
    setSelected(fieldId)

    const rect = getCanvasRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    dragRef.current = {
      fieldId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.map_x,
      origY: field.map_y,
      origW: field.map_w ?? 160,
      origH: field.map_h ?? 90,
      origRot: field.map_rotation ?? 0,
      centerX: field.map_x + (field.map_w ?? 160) / 2,
      centerY: field.map_y + (field.map_h ?? 90) / 2,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return

    const field = state.fields.find((f) => f.id === d.fieldId)
    if (!field) return

    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const rect = getCanvasRect()
    const minW = 60,
      minH = 40

    if (d.handle === 'move') {
      updateFieldFull(d.fieldId, {
        map_x: Math.round(Math.max(0, Math.min(rect.width - d.origW, d.origX + dx))),
        map_y: Math.round(Math.max(0, Math.min(rect.height - d.origH, d.origY + dy))),
      })
    } else if (d.handle === 'resize-se') {
      updateFieldFull(d.fieldId, {
        map_w: Math.round(Math.max(minW, d.origW + dx)),
        map_h: Math.round(Math.max(minH, d.origH + dy)),
      })
    } else if (d.handle === 'resize-sw') {
      const newW = Math.round(Math.max(minW, d.origW - dx))
      updateFieldFull(d.fieldId, {
        map_x: Math.round(d.origX + d.origW - newW),
        map_w: newW,
        map_h: Math.round(Math.max(minH, d.origH + dy)),
      })
    } else if (d.handle === 'resize-ne') {
      const newH = Math.round(Math.max(minH, d.origH - dy))
      updateFieldFull(d.fieldId, {
        map_y: Math.round(d.origY + d.origH - newH),
        map_w: Math.round(Math.max(minW, d.origW + dx)),
        map_h: newH,
      })
    } else if (d.handle === 'resize-nw') {
      const newW = Math.round(Math.max(minW, d.origW - dx))
      const newH = Math.round(Math.max(minH, d.origH - dy))
      updateFieldFull(d.fieldId, {
        map_x: Math.round(d.origX + d.origW - newW),
        map_y: Math.round(d.origY + d.origH - newH),
        map_w: newW,
        map_h: newH,
      })
    } else if (d.handle === 'rotate') {
      // Angle from field center to current mouse position
      const cx = d.centerX + (field.map_x - d.origX) // track center if moved
      const cy = d.centerY + (field.map_y - d.origY)
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const angle = Math.atan2(mouseY - cy, mouseX - cx) * (180 / Math.PI) + 90
      updateFieldFull(d.fieldId, { map_rotation: Math.round(((angle % 360) + 360) % 360) })
    }
  }

  function onPointerUp() {
    dragRef.current = null
  }

  async function handleRename(fieldId: number) {
    const field = state.fields.find((f) => f.id === fieldId)
    const name = prompt('Field name:', field?.name ?? '')
    if (name?.trim()) await updateFieldName(fieldId, name.trim())
  }

  async function handleAddField() {
    const name = prompt('New field name (e.g. Field 7):')
    if (!name?.trim()) return
    await addField(name.trim(), name.trim().replace(/[^0-9A-Za-z]/g, ''))
  }

  async function deleteField(fieldId: number) {
    if (!confirm('Remove this field?')) return
    const sb = createClient()
    await sb.from('fields').delete().eq('id', fieldId)
    setSelected(null)
    toast('Field removed')
  }

  const sel = state.fields.find((f) => f.id === selected)
  const fieldGameMap: Record<number, string> = {}
  state.games
    .filter((g) => ['Live', 'Starting', 'Halftime'].includes(g.status))
    .forEach((g) => {
      fieldGameMap[g.field_id] = `${g.home_team?.name ?? '?'} vs ${g.away_team?.name ?? '?'}`
    })

  // Extract embed src
  const embedSrc = embedCode
    ? embedCode.includes('src="')
      ? (embedCode.match(/src="([^"]+)"/)?.[1] ?? null)
      : embedCode.startsWith('http')
        ? embedCode
        : null
    : null

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
          PARK MAP
        </span>

        {/* View toggle */}
        <div className="flex rounded overflow-hidden border border-border">
          {(
            [
              { id: 'overlay', label: 'Overlay' },
              { id: 'photo', label: '📷 Photo', disabled: !photoPreview },
              { id: 'satellite', label: '🗺 Google Maps', disabled: !embedSrc && !mapsUrl },
            ] as { id: MapView; label: string; disabled?: boolean }[]
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => !v.disabled && setView(v.id)}
              className={cn(
                'font-cond text-[11px] font-bold px-3 py-1.5 transition-colors',
                view === v.id
                  ? 'bg-navy text-white'
                  : 'bg-surface-card text-muted hover:text-white',
                v.disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleAddField}
          className="flex items-center gap-1 font-cond text-[11px] font-bold px-3 py-1.5 rounded bg-navy hover:bg-navy-light text-white border border-border transition-colors"
        >
          <Plus size={12} /> ADD FIELD
        </button>

        <button
          onClick={() => setShowSettings((s) => !s)}
          className={cn(
            'flex items-center gap-1.5 font-cond text-[11px] font-bold px-3 py-1.5 rounded border transition-colors',
            showSettings
              ? 'bg-navy border-blue-400 text-white'
              : 'bg-surface-card border-border text-muted hover:text-white'
          )}
        >
          <MapPin size={11} /> MAP SETTINGS
        </button>

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-cond text-[11px] text-blue-300 hover:text-white ml-auto"
          >
            <ExternalLink size={11} /> Google Maps
          </a>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-surface-card border border-border rounded-xl p-5 mb-4">
          <div className="font-cond font-black text-[13px] tracking-wide mb-4">MAP SETTINGS</div>
          <div className="grid grid-cols-2 gap-5">
            {/* Photo */}
            <div>
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                PARK PHOTO
              </div>
              {photoPreview ? (
                <div
                  className="relative rounded-lg overflow-hidden border border-border mb-2"
                  style={{ height: 150 }}
                >
                  <img src={photoPreview} alt="Park" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setPhotoPreview(null)
                      setPhotoFile(null)
                      setSavedPhotoUrl(null)
                    }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red rounded-full flex items-center justify-center"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-36 rounded-lg border-2 border-dashed border-border hover:border-blue-400 flex flex-col items-center justify-center gap-2 bg-white/5 mb-2 transition-colors"
                >
                  <Upload size={20} className="text-muted" />
                  <span className="font-cond text-[10px] text-muted">Aerial photo or park map</span>
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="font-cond text-[11px] font-bold px-3 py-1.5 rounded border border-border text-muted hover:text-white transition-colors"
              >
                {photoPreview ? 'CHANGE' : 'CHOOSE FILE'}
              </button>
              {photoFile && (
                <div className="font-cond text-[10px] text-blue-300 mt-1">✓ {photoFile.name}</div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handlePhotoFile(f)
                }}
              />
            </div>

            {/* Google Maps */}
            <div>
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                GOOGLE MAPS
              </div>
              <div className="space-y-3">
                <div>
                  <label className="font-cond text-[10px] text-muted block mb-1">Park Name</label>
                  <input
                    className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[12px] outline-none focus:border-blue-400"
                    value={parkName}
                    onChange={(e) => setParkName(e.target.value)}
                    placeholder="Riverside Sports Complex"
                  />
                </div>
                <div>
                  <label className="font-cond text-[10px] text-muted block mb-1">
                    Google Maps URL (share link)
                  </label>
                  <input
                    className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[12px] outline-none focus:border-blue-400"
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                <div>
                  <label className="font-cond text-[10px] text-muted block mb-1 flex justify-between">
                    <span>Embed Code</span>
                    <a
                      href="https://www.google.com/maps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 text-[9px]"
                    >
                      Get from Google Maps →
                    </a>
                  </label>
                  <textarea
                    className="w-full bg-surface border border-border text-white px-2.5 py-2 rounded text-[11px] outline-none focus:border-blue-400 resize-none h-20 font-mono"
                    value={embedCode}
                    onChange={(e) => setEmbedCode(e.target.value)}
                    placeholder='<iframe src="https://www.google.com/maps/embed?..." ...'
                  />
                  <div className="font-cond text-[9px] text-muted mt-1">
                    Google Maps → Share → Embed a map → Copy HTML
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setShowSettings(false)}
              className="font-cond text-[12px] text-muted hover:text-white px-4 py-2"
            >
              CANCEL
            </button>
            <button
              onClick={saveSettings}
              disabled={saving || uploading}
              className="flex items-center gap-2 font-cond font-black text-[12px] tracking-wide bg-navy hover:bg-navy-light text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              <Save size={13} /> {uploading ? 'UPLOADING...' : saving ? 'SAVING...' : 'SAVE'}
            </button>
          </div>
        </div>
      )}

      {/* ── CANVAS ── */}
      <div
        ref={canvasRef}
        className="relative rounded-xl overflow-hidden select-none"
        style={{ height: 540, border: '1px solid #2a4080' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => setSelected(null)}
      >
        {/* Background layers */}
        {view === 'overlay' && (
          <>
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(150deg,#071a07 0%,#0a2a0a 100%)' }}
            />
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ opacity: 0.06 }}
            >
              {Array.from({ length: 26 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={i * 40}
                  y1={0}
                  x2={i * 40}
                  y2={540}
                  stroke="#7bb8ff"
                  strokeWidth={0.5}
                />
              ))}
              {Array.from({ length: 14 }, (_, i) => (
                <line
                  key={`h${i}`}
                  x1={0}
                  y1={i * 40}
                  x2={1040}
                  y2={i * 40}
                  stroke="#7bb8ff"
                  strokeWidth={0.5}
                />
              ))}
            </svg>
          </>
        )}
        {view === 'photo' && photoPreview && (
          <img
            src={photoPreview}
            alt="Park"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {view === 'photo' && !photoPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/20">
            <ImageIcon size={40} className="text-muted" />
            <button
              onClick={() => setShowSettings(true)}
              className="font-cond text-[12px] font-bold text-blue-300 hover:text-white"
            >
              Upload a photo in Map Settings →
            </button>
          </div>
        )}
        {view === 'satellite' && embedSrc && (
          <iframe
            src={embedSrc}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            loading="lazy"
          />
        )}
        {view === 'satellite' && !embedSrc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/20">
            <Map size={40} className="text-muted" />
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-cond text-[12px] font-bold text-blue-300 hover:text-white flex items-center gap-1.5"
              >
                <ExternalLink size={12} /> Open in Google Maps
              </a>
            ) : (
              <button
                onClick={() => setShowSettings(true)}
                className="font-cond text-[12px] font-bold text-blue-300 hover:text-white"
              >
                Add Google Maps embed code in Settings →
              </button>
            )}
          </div>
        )}

        {/* Dim overlay on photo/maps so field shapes are visible */}
        {(view === 'photo' || view === 'satellite') && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          />
        )}

        {/* Fields */}
        {state.fields.map((field) => {
          const isSel = selected === field.id
          const active = fieldGameMap[field.id]
          const color = field.map_color ?? '#1a6b1a'
          const opacity = (field.map_opacity ?? 70) / 100
          const rot = field.map_rotation ?? 0
          const w = field.map_w ?? 160
          const h = field.map_h ?? 90

          return (
            <div
              key={field.id}
              style={{
                position: 'absolute',
                left: field.map_x,
                top: field.map_y,
                width: w,
                height: h,
                transform: `rotate(${rot}deg)`,
                transformOrigin: 'center center',
                cursor: 'move',
                zIndex: isSel ? 20 : 10,
              }}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(isSel ? null : field.id)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                handleRename(field.id)
              }}
            >
              {/* Field body */}
              <div
                className="absolute inset-0 rounded-md border-2 flex flex-col items-center justify-center overflow-hidden"
                style={{
                  background: color,
                  opacity,
                  borderColor: isSel ? '#60a5fa' : active ? '#4ade80' : `${color}dd`,
                  borderWidth: isSel ? 2 : 1.5,
                }}
                onPointerDown={(e) => onPointerDown(e, field.id, 'move')}
              >
                <div className="font-cond text-3xl font-black text-white/25 leading-none pointer-events-none">
                  {field.number}
                </div>
                <div className="font-cond font-black text-[13px] text-white text-center px-2 leading-tight pointer-events-none">
                  {field.name}
                </div>
                {active && (
                  <div className="font-cond text-[9px] text-green-200 text-center px-1 truncate w-full pointer-events-none">
                    {active}
                  </div>
                )}
              </div>

              {/* Selection handles — only when selected */}
              {isSel && (
                <>
                  {/* Corner resize handles */}
                  {[
                    {
                      handle: 'resize-nw' as Handle,
                      style: { top: -5, left: -5, cursor: 'nw-resize' },
                    },
                    {
                      handle: 'resize-ne' as Handle,
                      style: { top: -5, right: -5, cursor: 'ne-resize' },
                    },
                    {
                      handle: 'resize-sw' as Handle,
                      style: { bottom: -5, left: -5, cursor: 'sw-resize' },
                    },
                    {
                      handle: 'resize-se' as Handle,
                      style: { bottom: -5, right: -5, cursor: 'se-resize' },
                    },
                  ].map(({ handle, style }) => (
                    <div
                      key={handle}
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        background: '#60a5fa',
                        border: '2px solid white',
                        borderRadius: 2,
                        zIndex: 30,
                        ...style,
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        onPointerDown(e, field.id, handle)
                      }}
                    />
                  ))}

                  {/* Rotate handle */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -28,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      cursor: 'grab',
                      zIndex: 30,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      onPointerDown(e, field.id, 'rotate')
                    }}
                  >
                    <div style={{ width: 1, height: 10, background: '#60a5fa' }} />
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        background: '#60a5fa',
                        borderRadius: '50%',
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <RotateCw size={10} color="white" />
                    </div>
                  </div>

                  {/* Selection border glow */}
                  <div
                    className="absolute inset-0 rounded-md pointer-events-none"
                    style={{ boxShadow: '0 0 0 2px #60a5fa, 0 0 12px rgba(96,165,250,0.4)' }}
                  />
                </>
              )}
            </div>
          )
        })}

        {/* Park name */}
        {parkName && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5 pointer-events-none">
            <MapPin size={11} className="text-blue-300" />
            <span className="font-cond font-bold text-[11px] text-white">{parkName}</span>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none">
          <div className="font-cond text-[9px] text-muted font-bold">
            DRAG · CORNER = RESIZE · ↻ = ROTATE
          </div>
        </div>
      </div>

      {/* ── SELECTED FIELD TOOLBAR ── */}
      {sel && (
        <div className="mt-3 bg-surface-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Name + info */}
            <div>
              <div className="font-cond font-black text-[14px] text-white">{sel.name}</div>
              <div className="font-cond text-[10px] text-muted">
                {sel.map_w ?? 160}×{sel.map_h ?? 90}px · {sel.map_rotation ?? 0}°
              </div>
            </div>

            {/* Color swatches */}
            <div className="flex items-center gap-1.5">
              <span className="font-cond text-[9px] text-muted uppercase tracking-wider mr-1">
                COLOR
              </span>
              {FIELD_COLORS.map((fc) => (
                <button
                  key={fc.value}
                  onClick={() => updateFieldFull(sel.id, { map_color: fc.value })}
                  title={fc.label}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                    sel.map_color === fc.value ? 'border-white scale-110' : 'border-transparent'
                  )}
                  style={{ background: fc.value }}
                />
              ))}
              {/* Custom color picker */}
              <label
                className="relative w-6 h-6 rounded-full border-2 border-border hover:border-white cursor-pointer overflow-hidden"
                title="Custom color"
              >
                <div
                  className="w-full h-full rounded-full"
                  style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}
                />
                <input
                  type="color"
                  value={sel.map_color ?? '#1a6b1a'}
                  onChange={(e) => updateFieldFull(sel.id, { map_color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>

            {/* Opacity */}
            <div className="flex items-center gap-2">
              <span className="font-cond text-[9px] text-muted uppercase tracking-wider">
                OPACITY
              </span>
              <input
                type="range"
                min={20}
                max={100}
                value={sel.map_opacity ?? 70}
                onChange={(e) => updateFieldFull(sel.id, { map_opacity: Number(e.target.value) })}
                className="w-20 accent-blue-400 h-1"
              />
              <span className="font-mono text-[11px] text-muted w-8">{sel.map_opacity ?? 70}%</span>
            </div>

            {/* Rotation number input */}
            <div className="flex items-center gap-2">
              <span className="font-cond text-[9px] text-muted uppercase tracking-wider">
                ROTATE
              </span>
              <input
                type="number"
                min={0}
                max={359}
                value={sel.map_rotation ?? 0}
                onChange={(e) => updateFieldFull(sel.id, { map_rotation: Number(e.target.value) })}
                className="w-16 bg-surface border border-border text-white px-2 py-1 rounded text-[11px] outline-none focus:border-blue-400"
              />
              <span className="font-cond text-[10px] text-muted">°</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleRename(sel.id)}
                className="font-cond text-[11px] font-bold px-3 py-1.5 rounded border border-border text-muted hover:text-white transition-colors"
              >
                RENAME
              </button>
              <button
                onClick={() => deleteField(sel.id)}
                className="font-cond text-[11px] font-bold px-3 py-1.5 rounded border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-1"
              >
                <Trash2 size={11} /> DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
