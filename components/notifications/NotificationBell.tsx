'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { NotificationDropdown } from './NotificationDropdown'
import * as db from '@/lib/db'

export function NotificationBell() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const bellButtonRef = useRef<HTMLButtonElement>(null)

  // Load initial unread count
  useEffect(() => {
    if (!user) return
    db.getUnreadNotificationCount(user.id).then(setUnreadCount)
  }, [user])

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return
    const sb = createClient()
    const channel = sb
      .channel('notification_log_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_log',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      sb.removeChannel(channel)
    }
  }, [user])

  // Outside click handler
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        bellButtonRef.current?.focus()
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [handleMouseDown])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        bellButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Early return after all hooks
  if (!user) return null

  return (
    <div ref={bellRef} className="relative">
      <button
        ref={bellButtonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 relative transition-colors duration-150"
        aria-label={
          unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications — no unread'
        }
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell size={16} className={isOpen ? 'text-white' : 'text-muted'} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-navy px-1">
            <span className="font-mono text-[10px] font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>
      {isOpen && (
        <NotificationDropdown
          userId={user.id}
          onClose={() => {
            setIsOpen(false)
            bellButtonRef.current?.focus()
          }}
          onUnreadChange={setUnreadCount}
        />
      )}
    </div>
  )
}
