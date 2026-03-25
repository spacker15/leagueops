'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import * as db from '@/lib/db'
import type { NotificationLogEntry } from '@/types'

interface Props {
  userId: string
  onClose: () => void
  onUnreadChange: (count: number) => void
  onOpenSettings?: () => void
}

export function NotificationDropdown({ userId, onClose, onUnreadChange, onOpenSettings }: Props) {
  const [notifications, setNotifications] = useState<NotificationLogEntry[]>([])

  useEffect(() => {
    db.getRecentNotifications(userId).then(setNotifications)
  }, [userId])

  async function handleMarkAllRead() {
    await db.markAllNotificationsRead(userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    onUnreadChange(0)
  }

  async function handleNotifClick(notif: NotificationLogEntry) {
    if (!notif.read_at) {
      await db.markNotificationRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      )
      onUnreadChange(notifications.filter((n) => !n.read_at && n.id !== notif.id).length)
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="absolute right-0 top-full mt-1 w-80 max-h-[400px] overflow-y-auto bg-[#061428] border border-[#1a2d50] rounded-b-xl shadow-2xl z-50"
        role="menu"
        style={{ animation: 'fadeSlideDown 150ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2d50]">
          <span className="font-cond text-[10px] font-black tracking-widest text-muted uppercase">
            Notifications
          </span>
          <button
            onClick={handleMarkAllRead}
            className="font-cond text-[10px] font-black tracking-wide text-muted hover:text-white transition-colors duration-150"
            role="menuitem"
          >
            Mark all read
          </button>
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 px-4">
            <span className="font-cond text-[12px] text-muted">No notifications yet</span>
            <span className="text-[11px] text-muted/60 mt-1">
              {"You'll see weather alerts, schedule changes, and game day updates here."}
            </span>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`px-4 py-3 border-b border-[#1a2d50] transition-colors duration-150 hover:bg-surface-card/50 cursor-pointer ${
                notif.read_at ? 'bg-transparent' : 'bg-surface-card'
              }`}
              role="menuitem"
              onClick={() => handleNotifClick(notif)}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-sans text-[13px] text-white line-clamp-2">
                    {notif.summary || notif.title || 'Notification'}
                  </span>
                  <span className="font-mono text-[10px] text-muted block mt-1">
                    {formatDistanceToNow(new Date(notif.delivered_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1a2d50]">
          <button
            onClick={onOpenSettings ?? onClose}
            className="font-cond text-[10px] font-black tracking-wide text-muted hover:text-white transition-colors duration-150 w-full text-left"
            role="menuitem"
          >
            Notification Settings
          </button>
        </div>
      </div>
    </>
  )
}
