'use server'

import { createClient } from '@/lib/supabase/server'
import type { AlertType, NotificationScope, NotificationQueueRow } from '@/types'

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
