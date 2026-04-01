'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/supabase/client'
import toast from 'react-hot-toast'
import { Btn, FormField, Input, SectionHeader, Card } from '@/components/ui'

export function SettingsTab() {
  const { school, schoolId } = useApp()
  const [name, setName] = useState(school?.name ?? '')
  const [mascot, setMascot] = useState(school?.mascot ?? '')
  const [primaryColor, setPrimaryColor] = useState(school?.primary_color ?? '#0B3D91')
  const [secondaryColor, setSecondaryColor] = useState(school?.secondary_color ?? '#D62828')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const sb = createClient()
    const { error } = await sb
      .from('schools')
      .update({ name, mascot, primary_color: primaryColor, secondary_color: secondaryColor })
      .eq('id', schoolId)
    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success('Settings saved')
    setSaving(false)
  }

  return (
    <div className="tab-content max-w-2xl">
      <SectionHeader>School Settings</SectionHeader>

      <Card className="p-6 space-y-4 mt-4">
        <FormField label="School Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Mascot">
          <Input
            value={mascot}
            onChange={(e) => setMascot(e.target.value)}
            placeholder="e.g. Knights"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Primary Color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-8 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </FormField>
          <FormField label="Secondary Color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-8 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </FormField>
        </div>

        <div className="pt-2">
          <Btn variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Btn>
        </div>
      </Card>

      <SectionHeader className="mt-6">External Integrations</SectionHeader>
      <Card className="p-6 mt-4 space-y-3">
        <div>
          <div className="font-cond font-black text-[13px] text-white mb-1">FHSAA</div>
          <div className="font-cond text-[11px] text-muted mb-2">
            Florida High School Athletic Association — manage eligibility and compliance.
          </div>
          <a
            href="https://www.fhsaahome.org/login"
            target="_blank"
            rel="noopener noreferrer"
            className="font-cond text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
          >
            fhsaahome.org →
          </a>
        </div>
        <div className="border-t border-border pt-3">
          <div className="font-cond font-black text-[13px] text-white mb-1">Arbiter Sports</div>
          <div className="font-cond text-[11px] text-muted mb-2">
            Official assignment and scheduling for referees.
          </div>
          <a
            href="https://arbiter.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-cond text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
          >
            arbiter.io →
          </a>
        </div>
        <div className="border-t border-border pt-3">
          <div className="font-cond font-black text-[13px] text-white mb-1">NFHS Network</div>
          <div className="font-cond text-[11px] text-muted mb-2">
            Live game broadcasts for parents and fans.
          </div>
          <a
            href="https://www.nfhsnetwork.com/subscribe/event"
            target="_blank"
            rel="noopener noreferrer"
            className="font-cond text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
          >
            nfhsnetwork.com →
          </a>
        </div>
      </Card>
    </div>
  )
}
