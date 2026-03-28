'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/supabase/client'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/ui'
import toast from 'react-hot-toast'
import { Upload, X, Save, RefreshCw, Globe, Calendar, MapPin, Palette } from 'lucide-react'

interface EventSettings {
  id: number
  name: string
  location: string
  start_date: string
  end_date: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
}

const inp =
  'w-full bg-white/5 border border-border text-white px-3 py-2.5 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors'
const lbl = 'font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5'

export function LeagueSettingsTab() {
  const { eventId } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0B3D91')
  const [secondaryColor, setSecondaryColor] = useState('#D62828')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const sb = createClient()
    setLoading(true)
    const { data } = await sb.from('events').select('*').eq('id', 1).single()
    if (data) {
      const ev = data as EventSettings
      setSettings(ev)
      setName(ev.name ?? '')
      setLocation(ev.location ?? '')
      setStartDate(ev.start_date ?? '')
      setEndDate(ev.end_date ?? '')
      setPrimaryColor(ev.primary_color ?? '#0B3D91')
      setSecondaryColor(ev.secondary_color ?? '#D62828')
      setLogoUrl(ev.logo_url ?? null)
      setLogoPreview(ev.logo_url ?? null)
    }
    setLoading(false)
  }

  function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Logo must be under 3MB')
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removeLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoUrl(null)
  }

  async function save() {
    if (!name) {
      toast.error('League name is required')
      return
    }
    setSaving(true)
    const sb = createClient()

    let finalLogoUrl = logoUrl

    // Upload new logo if selected
    if (logoFile) {
      setUploading(true)
      const ext = logoFile.name.split('.').pop() ?? 'png'
      const path = `events/1/logo.${ext}`
      const { error: upErr } = await sb.storage
        .from('program-assets')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (upErr) {
        toast.error(`Logo upload failed: ${upErr.message}`)
        setSaving(false)
        setUploading(false)
        return
      }
      const { data: urlData } = sb.storage.from('program-assets').getPublicUrl(path)
      finalLogoUrl = urlData.publicUrl
      setLogoUrl(finalLogoUrl)
      setLogoFile(null)
      setUploading(false)
    }

    // Save event record
    const { error } = await sb
      .from('events')
      .update({
        name,
        location,
        start_date: startDate || null,
        end_date: endDate || null,
        logo_url: finalLogoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('League settings saved')
      // Log it
      await sb.from('ops_log').insert({
        event_id: eventId,
        message: `League settings updated: "${name}"`,
        log_type: 'info',
        occurred_at: new Date().toISOString(),
      })
    }
    setSaving(false)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-muted font-cond">LOADING...</div>
    )

  return (
    <div className="max-w-2xl">
      <SectionHeader>LEAGUE SETTINGS</SectionHeader>

      <div className="space-y-5 mt-4">
        {/* ── Logo ── */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={15} className="text-muted" />
            <div className="font-cond font-black text-[13px] tracking-wide">LEAGUE LOGO</div>
          </div>

          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="flex-shrink-0">
              {logoPreview ? (
                <div className="relative">
                  <div className="w-28 h-28 rounded-xl border-2 border-border bg-white/5 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoPreview}
                      alt="League logo"
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red rounded-full flex items-center justify-center shadow-lg"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-28 h-28 rounded-xl border-2 border-dashed border-border hover:border-blue-400 flex flex-col items-center justify-center gap-2 transition-colors bg-white/5 group"
                >
                  <Upload
                    size={22}
                    className="text-muted group-hover:text-blue-400 transition-colors"
                  />
                  <span className="font-cond text-[9px] font-bold tracking-widest text-muted group-hover:text-blue-400 uppercase">
                    UPLOAD
                  </span>
                </button>
              )}
            </div>

            {/* Instructions + buttons */}
            <div className="flex-1">
              <div className="font-cond text-[12px] text-muted leading-relaxed mb-4">
                Your league logo appears on player check-in cards, the program registration page,
                and printed materials. Square or circular logos work best. PNG or JPG, max 3MB.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="font-cond text-[12px] font-bold tracking-wide px-4 py-2 rounded-lg bg-navy hover:bg-navy-light text-white transition-colors"
                >
                  {logoPreview ? 'CHANGE LOGO' : 'CHOOSE FILE'}
                </button>
                {logoPreview && (
                  <button
                    onClick={removeLogo}
                    className="font-cond text-[12px] font-bold tracking-wide px-4 py-2 rounded-lg border border-border text-muted hover:text-white transition-colors"
                  >
                    REMOVE
                  </button>
                )}
              </div>
              {logoFile && (
                <div className="mt-2 font-cond text-[11px] text-blue-300">
                  ✓ {logoFile.name} ready to upload — click Save Settings
                </div>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleLogoFile(f)
            }}
          />
        </div>

        {/* ── Event info ── */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} className="text-muted" />
            <div className="font-cond font-black text-[13px] tracking-wide">
              LEAGUE / EVENT INFORMATION
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>League / Event Name *</label>
              <input
                className={inp}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Knights Lacrosse Summer Invitational 2025"
              />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Location / Venue</label>
              <input
                className={inp}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Riverside Sports Complex, Jacksonville FL"
              />
            </div>
            <div>
              <label className={lbl}>Start Date</label>
              <input
                type="date"
                className={inp}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={lbl}>End Date</label>
              <input
                type="date"
                className={inp}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Colors ── */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={15} className="text-muted" />
            <div className="font-cond font-black text-[13px] tracking-wide">LEAGUE COLORS</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Primary Color</label>
              <div className="flex gap-2 items-center">
                <div className="w-10 h-10 rounded-lg border-2 border-border flex-shrink-0 overflow-hidden">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full h-full cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  className={cn(inp, 'font-mono')}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#0B3D91"
                  maxLength={7}
                />
              </div>
            </div>
            <div>
              <label className={lbl}>Secondary / Accent Color</label>
              <div className="flex gap-2 items-center">
                <div className="w-10 h-10 rounded-lg border-2 border-border flex-shrink-0 overflow-hidden">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full h-full cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  className={cn(inp, 'font-mono')}
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#D62828"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Color preview */}
          <div className="mt-4 rounded-lg overflow-hidden border border-border">
            <div
              className="px-4 py-2.5 flex items-center gap-3"
              style={{ background: primaryColor }}
            >
              {logoPreview && (
                <img src={logoPreview} alt="" className="w-7 h-7 object-contain rounded" />
              )}
              <span className="font-cond font-black text-white text-[14px] tracking-widest">
                LEAGUEOPS
              </span>
              <span className="font-cond text-[11px] text-white/60 ml-auto">
                {name || 'Your League Name'}
              </span>
            </div>
            <div className="h-1" style={{ background: secondaryColor }} />
            <div className="px-4 py-2 bg-surface flex gap-2">
              {['Dashboard', 'Schedule', 'Check-In', 'Rosters'].map((t) => (
                <span key={t} className="font-cond text-[11px] font-bold text-white/60">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="font-cond text-[10px] text-muted mt-2">
            Color customization will apply to printed materials and player cards.
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3">
          <button
            onClick={load}
            disabled={loading || saving}
            className="flex items-center gap-2 font-cond text-[12px] font-bold text-muted hover:text-white px-4 py-2.5 transition-colors"
          >
            <RefreshCw size={13} /> RESET
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wider bg-navy hover:bg-navy-light text-white px-8 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {uploading ? 'UPLOADING LOGO...' : saving ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>
    </div>
  )
}
