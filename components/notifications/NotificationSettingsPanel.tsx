'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { Btn, Card, SectionHeader } from '@/components/ui'
import { NotificationToggleRow } from './NotificationToggleRow'
import toast from 'react-hot-toast'
import { createClient } from '@/supabase/client'
import { ALERT_TYPES, ALERT_TYPE_ROLES } from '@/lib/notification-constants'
import type { AlertType, NotificationPreference } from '@/types'

type PrefMap = Map<AlertType, { email_on: boolean; push_on: boolean }>

export function NotificationSettingsPanel() {
  const { user, userRoles } = useAuth()
  const [prefs, setPrefs] = useState<PrefMap>(new Map())
  const [saving, setSaving] = useState(false)

  // Load preferences on mount — hooks before guard per CLAUDE.md
  useEffect(() => {
    if (!user) return
    const sb = createClient()
    sb.from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map: PrefMap = new Map()
        const rows = (data ?? []) as NotificationPreference[]
        for (const row of rows) {
          map.set(row.alert_type, { email_on: row.email_on, push_on: row.push_on })
        }
        setPrefs(map)
      })
  }, [user])

  // Early return after all hooks
  if (!user) return null

  const userRoleNames = userRoles.map((r) => r.role as string)
  const visibleAlertTypes = ALERT_TYPES.filter((at) =>
    ALERT_TYPE_ROLES[at.value].some((role) => userRoleNames.includes(role))
  )

  function updatePref(alertType: AlertType, field: 'email_on' | 'push_on', value: boolean) {
    setPrefs((prev) => {
      const next = new Map(prev)
      const current = next.get(alertType) ?? { email_on: true, push_on: true }
      next.set(alertType, { ...current, [field]: value })
      return next
    })
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const sb = createClient()
      const rows = visibleAlertTypes.map((at) => {
        const p = prefs.get(at.value) ?? { email_on: true, push_on: true }
        return {
          user_id: user.id,
          alert_type: at.value,
          email_on: p.email_on,
          push_on: p.push_on,
          updated_at: new Date().toISOString(),
        }
      })
      const { error } = await sb
        .from('notification_preferences')
        .upsert(rows, { onConflict: 'user_id,alert_type' })
      if (error) throw error
      toast.success('Preferences saved')
    } catch {
      toast.error('Could not save preferences. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader>Notification Preferences</SectionHeader>
      {visibleAlertTypes.map((alertType) => (
        <Card key={alertType.value}>
          <NotificationToggleRow
            label={alertType.label}
            description={alertType.description}
            emailOn={prefs.get(alertType.value)?.email_on ?? true}
            pushOn={prefs.get(alertType.value)?.push_on ?? true}
            onEmailChange={(on) => updatePref(alertType.value, 'email_on', on)}
            onPushChange={(on) => updatePref(alertType.value, 'push_on', on)}
          />
        </Card>
      ))}
      <div className="flex justify-end">
        <Btn variant="primary" onClick={handleSave} disabled={saving}>
          Save Preferences
        </Btn>
      </div>
    </div>
  )
}
