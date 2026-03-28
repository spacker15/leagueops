'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

interface Props {
  token: string
  type: 'referee' | 'volunteer' | 'trainer'
  eventName: string
  primaryColor: string
  logoUrl: string | null
}

export function JoinClient({ token, type, eventName, primaryColor, logoUrl }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const label =
    type === 'referee' ? 'Referee' : type === 'trainer' ? 'Athletic Trainer' : 'Volunteer'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, first_name: firstName, last_name: lastName, email, phone }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.')
      return
    }

    setDone(true)
  }

  const inp =
    'w-full bg-[#030d20] border border-[#1a2d50] text-white px-4 py-3 rounded-xl text-[14px] outline-none focus:border-blue-400 transition-colors placeholder-[#3a4e6a]'
  const lbl =
    'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'

  if (done) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: '#020810' }}
      >
        <div className="bg-[#081428] border border-green-800/50 rounded-2xl p-8 max-w-sm w-full text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
          <div className="font-cond font-black text-[22px] text-white mb-2">
            YOU&apos;RE REGISTERED!
          </div>
          <div className="font-cond text-[13px] text-[#5a6e9a] mb-1">
            Thanks, {firstName}! You&apos;ve been added as a {label.toLowerCase()} for
          </div>
          <div className="font-cond font-black text-[15px] text-white mb-4">{eventName}</div>
          <div className="font-cond text-[11px] text-[#5a6e9a]">
            Your event coordinator will be in touch with next steps.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: '#020810' }}
    >
      {/* Card */}
      <div className="w-full max-w-md">
        {/* Header accent */}
        <div className="h-1.5 rounded-t-2xl" style={{ background: primaryColor }} />

        <div className="bg-[#081428] border border-[#1a2d50] border-t-0 rounded-b-2xl p-8">
          {/* Logo / branding */}
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
              <div
                className="font-cond text-[11px] font-black tracking-[.12em] uppercase"
                style={{ color: primaryColor }}
              >
                {label} Registration
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First Name *</label>
                <input
                  className={inp}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  autoFocus
                />
              </div>
              <div>
                <label className={lbl}>Last Name *</label>
                <input
                  className={inp}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className={lbl}>Email *</label>
              <input
                type="email"
                className={inp}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label className={lbl}>Phone Number</label>
              <input
                type="tel"
                className={inp}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </div>

            {error && (
              <div className="font-cond text-[12px] text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full font-cond font-black text-[14px] tracking-[.1em] py-3 rounded-xl text-white transition-all disabled:opacity-50"
              style={{ background: primaryColor }}
            >
              {submitting ? 'SUBMITTING...' : `REGISTER AS ${label.toUpperCase()}`}
            </button>
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
