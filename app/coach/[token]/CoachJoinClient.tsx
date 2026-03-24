'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { Btn } from '@/components/ui'
import toast from 'react-hot-toast'

// Dark theme styling variables (match JoinClient.tsx exactly)
const inp =
  'w-full bg-[#030d20] border border-[#1a2d50] text-white px-4 py-3 rounded-xl text-[13px] outline-none focus:border-blue-400 transition-colors placeholder-[#3a4e6a]'
const lbl =
  'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'

interface CoachJoinClientProps {
  token: string
  inviteId: number
  programId: number
  eventId: number
  eventName: string
  primaryColor: string
  logoUrl: string | null
  programName: string
  teams: { id: number; team_name: string; division: string }[]
}

export function CoachJoinClient({
  token,
  inviteId: _inviteId,
  programId: _programId,
  eventId: _eventId,
  eventName,
  primaryColor,
  logoUrl,
  programName: _programName,
  teams,
}: CoachJoinClientProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [certifications, setCertifications] = useState('')
  const [teamId, setTeamId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#020810' }}>
        <div className="bg-[#081428] border border-green-800/50 rounded-2xl p-8 max-w-sm w-full text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
          <div className="font-cond font-black text-[22px] text-white mb-2">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            YOU'RE REGISTERED!
          </div>
          <div className="font-cond text-[13px] text-[#5a6e9a]">
            {`Thanks, ${firstName}! You've been added as a coach for ${eventName}.`}
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !teamId) {
      toast.error('Please fill in all required fields including team selection.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firstName, lastName, email, phone, certifications, teamId }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: '#020810' }}
    >
      <div className="w-full max-w-md">
        {/* Navy accent bar */}
        <div className="h-1.5 bg-[#0B3D91] rounded-t-2xl" />

        <div className="bg-[#081428] border border-[#1a2d50] border-t-0 rounded-b-2xl p-8">
          {/* Event branding */}
          <div className="flex items-center gap-3 mb-6">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: primaryColor + '30', border: `1px solid ${primaryColor}60` }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
                  <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
                  <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
                  <rect
                    x="12"
                    y="12"
                    width="9"
                    height="9"
                    rx="1.5"
                    fill="white"
                    fillOpacity="0.35"
                  />
                </svg>
              </div>
            )}
            <div>
              <div className="font-cond font-black text-[18px] text-white leading-tight">
                {eventName}
              </div>
              <div className="font-cond text-[11px] font-black tracking-[.12em] uppercase text-[#0B3D91]">
                Coach Registration
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First + Last Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First Name *</label>
                <input
                  className={inp}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoFocus
                />
              </div>
              <div>
                <label className={lbl}>Last Name *</label>
                <input
                  className={inp}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={lbl}>Email *</label>
              <input
                type="email"
                className={inp}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
              />
            </div>

            {/* Phone */}
            <div>
              <label className={lbl}>Phone</label>
              <input
                type="tel"
                className={inp}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>

            {/* Certifications */}
            <div>
              <label className={lbl}>Certifications</label>
              <textarea
                className={inp + ' min-h-[80px] resize-none'}
                value={certifications}
                onChange={(e) => setCertifications(e.target.value)}
                placeholder="e.g. US Lacrosse Level 2"
              />
            </div>

            {/* Team selection */}
            <div>
              <label className={lbl}>Select Team *</label>
              <select
                className={inp + ' bg-[#040e24]'}
                value={teamId ?? ''}
                onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Select a team --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name} ({t.division})
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <Btn
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? 'REGISTERING...' : 'COMPLETE REGISTRATION'}
            </Btn>
          </form>

          <div className="mt-5 pt-4 border-t border-[#1a2d50] text-center">
            <div className="font-cond text-[10px] text-[#3a4e6a]">
              Powered by <span className="font-black text-[#5a6e9a]">LEAGUEOPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
