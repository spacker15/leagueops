'use client'
import { useState, useEffect, useRef } from 'react'
import { CalendarPlus, RefreshCw, Download, X } from 'lucide-react'

interface Props {
  slug: string
  teamId?: number
  program?: string
  label?: string
}

export function AddToCalendarBtn({ slug, teamId, program, label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const params = new URLSearchParams()
  if (teamId) params.set('team', String(teamId))
  else if (program) params.set('program', program)
  const query = params.toString() ? `?${params.toString()}` : ''
  const apiPath = `/api/ics/${slug}${query}`

  function getWebcalUrl() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return (origin + apiPath).replace(/^https?:/, 'webcal:')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="flex items-center gap-1.5 font-cond text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-lg border border-[#1a2d50] text-[#5a6e9a] hover:text-white hover:border-[#0B3D91] transition-colors bg-[#081428]"
      >
        <CalendarPlus size={13} />
        {label ?? 'Add to Calendar'}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 z-50 w-64 bg-[#081428] border border-[#1a2d50] rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2d50]">
            <span className="font-cond text-[11px] font-bold text-white tracking-wide">
              ADD TO CALENDAR
            </span>
            <button onClick={() => setOpen(false)}>
              <X size={12} className="text-[#5a6e9a] hover:text-white" />
            </button>
          </div>

          {/* Subscribe — live updates */}
          <a
            href={getWebcalUrl()}
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-3 py-3 hover:bg-[#0d1f3c] transition-colors border-b border-[#1a2d50]"
          >
            <RefreshCw size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-cond text-[12px] font-bold text-white">Subscribe</div>
              <div className="font-cond text-[10px] text-[#5a6e9a] mt-0.5">
                Live updates — games added automatically. Opens Apple Calendar, Google Calendar, or Outlook.
              </div>
            </div>
          </a>

          {/* Download — one-time */}
          <a
            href={apiPath}
            download={`${slug}.ics`}
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-3 py-3 hover:bg-[#0d1f3c] transition-colors"
          >
            <Download size={14} className="text-green-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-cond text-[12px] font-bold text-white">Download .ics</div>
              <div className="font-cond text-[10px] text-[#5a6e9a] mt-0.5">
                One-time import. Works with any calendar app.
              </div>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
