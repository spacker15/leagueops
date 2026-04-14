'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/supabase/client'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type NotifType = 'incident' | 'game' | 'medical' | 'weather'

interface Notif {
  id: string
  message: string
  type: NotifType
  time: Date
  read: boolean
}

const TYPE_ICON: Record<NotifType, string> = {
  incident: '🚨',
  game: '⚽',
  medical: '🏥',
  weather: '⚡',
}

export function NotificationBell() {
  const { state } = useApp()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const eventId = state.event?.id

  const addNotif = useCallback((message: string, type: NotifType) => {
    setNotifs((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          message,
          type,
          time: new Date(),
          read: false,
        },
        ...prev,
      ].slice(0, 50)
    )
  }, [])

  useEffect(() => {
    if (!eventId) return
    const sb = createClient()

    const sub = sb
      .channel(`notif-${eventId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, (payload) => {
        const g = payload.new as any
        const old = payload.old as any
        if (g.status !== old.status) {
          const msg = `Game #${g.id} → ${g.status}`
          addNotif(msg, 'game')
          toast(msg, { icon: '⚽', duration: 4000 })
        } else if (g.home_score !== old.home_score || g.away_score !== old.away_score) {
          const msg = `Game #${g.id} score: ${g.home_score}–${g.away_score}`
          addNotif(msg, 'game')
          toast(msg, { icon: '⚽', duration: 4000 })
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          const inc = payload.new as any
          const msg = `New incident: ${inc.type}${inc.person_involved ? ` — ${inc.person_involved}` : ''}`
          addNotif(msg, 'incident')
          toast.error(msg, { duration: 6000 })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medical_incidents' },
        (payload) => {
          const m = payload.new as any
          const msg = `Trainer dispatched: ${m.trainer_name} → ${m.player_name}`
          addNotif(msg, 'medical')
          toast(msg, {
            icon: '🏥',
            style: { background: '#1a3060', color: 'white' },
            duration: 6000,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'weather_alerts' },
        (payload) => {
          const w = payload.new as any
          const msg = `Weather alert: ${w.alert_type}`
          addNotif(msg, 'weather')
          toast(msg, {
            icon: '⚡',
            style: { background: '#6b0000', color: 'white' },
            duration: 8000,
          })
        }
      )
      .subscribe()

    return () => {
      sb.removeChannel(sub)
    }
  }, [eventId, addNotif])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifs.filter((n) => !n.read).length

  function toggleOpen() {
    setOpen((o) => !o)
    // Mark all read when opening
    if (!open) {
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={toggleOpen}
        className="relative p-1.5 rounded hover:bg-white/10 transition-colors text-[#4a5e80] hover:text-white"
        title="Notifications"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red rounded-full text-[9px] font-black text-white flex items-center justify-center leading-none px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: '#061428', border: '1px solid #1a2d50' }}
        >
          <div className="px-4 py-2.5 border-b border-[#1a2d50] flex items-center justify-between">
            <span className="font-cond text-[11px] font-black tracking-widest text-muted uppercase">
              Notifications
            </span>
            {notifs.length > 0 && (
              <button
                onClick={() => setNotifs([])}
                className="font-cond text-[9px] text-muted hover:text-white transition-colors"
              >
                CLEAR ALL
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center font-cond text-[11px] text-muted font-bold tracking-widest">
                NO NOTIFICATIONS
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 items-start px-4 py-2.5 border-b border-[#0f1f3a] transition-colors',
                    !n.read ? 'bg-blue-900/10' : 'hover:bg-white/5'
                  )}
                >
                  <span className="text-[14px] flex-shrink-0 mt-0.5">{TYPE_ICON[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-white leading-snug">{n.message}</div>
                    <div className="text-[10px] text-muted font-cond mt-0.5">
                      {n.time.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
