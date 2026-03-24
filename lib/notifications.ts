'use server'

import { createClient } from '@/lib/supabase/server'
import type { AlertType, NotificationScope, NotificationQueueRow } from '@/types'

export const ALERT_TYPES: { value: AlertType; label: string; description: string }[] = [
  {
    value: 'weather_alert',
    label: 'Weather Alerts',
    description: 'Lightning delays, field closures, and game suspensions.',
  },
  {
    value: 'schedule_change',
    label: 'Schedule Changes',
    description: 'Game reschedules and cancellations.',
  },
  {
    value: 'admin_alert',
    label: 'Admin Alerts',
    description: 'Referee no-shows, registration deadlines, and ops issues.',
  },
  {
    value: 'registration_update',
    label: 'Registration Updates',
    description: 'New team registrations and coach invite activity.',
  },
]

export const NOTIFICATION_CHANNELS = ['email', 'push'] as const

/** Roles that can see each alert type in preferences panel (per D-03) */
export const ALERT_TYPE_ROLES: Record<AlertType, string[]> = {
  weather_alert: ['admin', 'coach', 'program_leader'],
  schedule_change: ['admin', 'coach', 'program_leader'],
  admin_alert: ['admin'],
  registration_update: ['admin', 'program_leader'],
}

/** Storm cap: max notifications per event per hour (per D-14) */
export const STORM_CAP = 50

/** Dedup window in milliseconds: 5 minutes (per D-13) */
export const DEDUP_WINDOW_MS = 5 * 60 * 1000

/** Insert a notification into the queue. Returns the inserted row or null on error. */
export async function insertNotification(
  eventId: number,
  alertType: AlertType,
  scope: NotificationScope,
  scopeId: number | null,
  payload: { title: string; summary: string; detail: string; cta_url: string }
): Promise<NotificationQueueRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_queue')
    .insert({
      event_id: eventId,
      alert_type: alertType,
      scope,
      scope_id: scopeId,
      payload,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to insert notification:', error)
    return null
  }
  return data as NotificationQueueRow
}
