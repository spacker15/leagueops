'use client'

import { useState } from 'react'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react'

type Step = 'account' | 'program' | 'confirm' | 'done'

const DIVISIONS = [
  '8U Boys', '10U Boys', '12U Boys', '14U Boys', '16U Boys', '18U Boys',
  '8U Girls', '10U Girls', '12U Girls', '14U Girls', '16U Girls', '18U Girls',
]

const STATES = ['AL','AR','FL','GA','MS','NC','SC','TN','TX','VA']

export function RegisterPage() {
  const [step, setStep]   = useState<Step>('account')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Account fields
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // Program fields
  const [progName, setProgName]       = useState('')
  const [shortName, setShortName]     = useState('')
  const [association, setAssociation] = useState('')
  const [city, setCity]               = useState('')
  const [state, setState]             = useState('FL')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [website, setWebsite]         = useState('')
  const [notes, setNotes]             = useState('')

  // Teams
  const [teams, setTeams] = useState([
    { name: '', division: '14U Boys', coachName: '', coachEmail: '', playerCount: '' }
  ])

  function addTeam() {
    setTeams(prev => [...prev, { name: '', division: '14U Boys', coachName: '', coachEmail: '', playerCount: '' }])
  }

  function removeTeam(i: number) {
    setTeams(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateTeam(i: number, field: string, value: string) {
    setTeams(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function validateAccount() {
    if (!email || !password || !confirmPw) { setError('All fields required'); return false }
    if (password !== confirmPw) { setError('Passwords do not match'); return false }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return false }
    if (!email.includes('@')) { setError('Enter a valid email address'); return false }
    setError(''); return true
  }

  function validateProgram() {
    if (!progName || !contactName) { setError('Program name and contact name required'); return false }
    if (teams.some(t => !t.name)) { setError('Each team needs a name'); return false }
    setError(''); return true
  }

  async function submit() {
    setSaving(true)
    setError('')
    const sb = createClient()

    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await sb.auth.signUp({
        email,
        password,
      })
      if (authErr) throw new Error(authErr.message)
      if (!authData.user) throw new Error('Failed to create account')

      const userId = authData.user.id

      // 2. Create program record (status: pending — needs admin approval)
      const { data: prog, error: progErr } = await sb.from('programs').insert({
        name:          progName,
        short_name:    shortName || null,
        association:   association || null,
        city:          city || null,
        state,
        contact_name:  contactName,
        contact_email: email,
        contact_phone: contactPhone || null,
        website:       website || null,
        notes:         notes || null,
        status:        'pending',
      }).select().single()
      if (progErr) throw new Error(progErr.message)

      // 3. Link user to program
      await sb.from('program_leaders').insert({
        user_id:    userId,
        program_id: prog.id,
        is_primary: true,
      })

      // 4. Create user role (pending until approved)
      await sb.from('user_roles').insert({
        user_id:      userId,
        role:         'program_leader',
        display_name: contactName,
        program_id:   prog.id,
        event_id:     1,
        is_active:    false, // activated when program is approved
      })

      // 5. Submit team registration requests
      for (const team of teams) {
        if (!team.name) continue
        await sb.from('team_registrations').insert({
          program_id:       prog.id,
          event_id:         1,
          team_name:        team.name,
          division:         team.division,
          head_coach_name:  team.coachName || null,
          head_coach_email: team.coachEmail || null,
          player_count:     team.playerCount ? Number(team.playerCount) : null,
          status:           'pending',
        })
      }

      // 6. Notify ops log
      await sb.from('ops_log').insert({
        event_id:    1,
        message:     `New program registration: ${progName} (${email}) — ${teams.length} team(s) pending review`,
        log_type:    'info',
        occurred_at: new Date().toISOString(),
      })

      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-border text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors'
  const labelCls = 'font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1'

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red rounded flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
          <span className="font-cond text-xl font-black tracking-widest text-white">LEAGUEOPS</span>
        </div>
        <a href="/" className="font-cond text-[11px] text-muted hover:text-white transition-colors">
          ← Back to Login
        </a>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="font-cond font-black text-[28px] text-white tracking-wide mb-2">
            PROGRAM REGISTRATION
          </div>
          <div className="font-cond text-[13px] text-muted">
            Register your program to manage teams and rosters
          </div>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center gap-0 mb-8">
            {[
              { id: 'account', label: 'Account' },
              { id: 'program', label: 'Program & Teams' },
              { id: 'confirm', label: 'Review' },
            ].map((s, i) => {
              const steps = ['account', 'program', 'confirm']
              const current = steps.indexOf(step)
              const mine = steps.indexOf(s.id)
              const done = mine < current
              const active = mine === current
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center font-cond font-black text-[11px] flex-shrink-0',
                    done   ? 'bg-green-600 text-white' :
                    active ? 'bg-navy-light border-2 border-blue-400 text-white' :
                    'bg-surface-card border border-border text-muted'
                  )}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div className={cn(
                    'font-cond text-[11px] font-bold ml-2 flex-shrink-0',
                    active ? 'text-white' : done ? 'text-green-400' : 'text-muted'
                  )}>{s.label}</div>
                  {i < 2 && <div className="flex-1 h-px bg-border mx-3" />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── STEP 1: Account ── */}
        {step === 'account' && (
          <div className="bg-surface-card border border-border rounded-xl p-6">
            <div className="font-cond font-black text-[15px] tracking-wide mb-5">CREATE YOUR ACCOUNT</div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" className={inputCls} value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="you@yourprogram.com" />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="password" className={inputCls} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
              </div>
              <div>
                <label className={labelCls}>Confirm Password</label>
                <input type="password" className={inputCls} value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat password" />
              </div>
            </div>
            {error && <ErrorBox msg={error} />}
            <div className="flex justify-end mt-5">
              <button onClick={() => { if (validateAccount()) setStep('program') }}
                className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wider bg-navy hover:bg-navy-light text-white px-6 py-2.5 rounded-lg transition-colors">
                NEXT <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Program & Teams ── */}
        {step === 'program' && (
          <div className="space-y-4">
            {/* Program info */}
            <div className="bg-surface-card border border-border rounded-xl p-6">
              <div className="font-cond font-black text-[15px] tracking-wide mb-5">PROGRAM INFORMATION</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Program Name *</label>
                  <input className={inputCls} value={progName}
                    onChange={e => setProgName(e.target.value)}
                    placeholder="e.g. Fleming Island Youth Lacrosse" />
                </div>
                <div>
                  <label className={labelCls}>Short Name / Abbreviation</label>
                  <input className={inputCls} value={shortName}
                    onChange={e => setShortName(e.target.value)} placeholder="e.g. FIYLA" />
                </div>
                <div>
                  <label className={labelCls}>Association</label>
                  <input className={inputCls} value={association}
                    onChange={e => setAssociation(e.target.value)} placeholder="e.g. NFYLL" />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={city}
                    onChange={e => setCity(e.target.value)} placeholder="Fleming Island" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select className={inputCls} value={state} onChange={e => setState(e.target.value)}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Primary Contact Name *</label>
                  <input className={inputCls} value={contactName}
                    onChange={e => setContactName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className={labelCls}>Contact Phone</label>
                  <input className={inputCls} value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)} placeholder="(904) 555-0100" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Program Website</label>
                  <input className={inputCls} value={website}
                    onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notes / Questions for Admin</label>
                  <textarea className={cn(inputCls, 'resize-y min-h-[60px]')} value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Anything you'd like us to know..." />
                </div>
              </div>
            </div>

            {/* Teams */}
            <div className="bg-surface-card border border-border rounded-xl p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="font-cond font-black text-[15px] tracking-wide">TEAMS TO REGISTER</div>
                <button onClick={addTeam}
                  className="font-cond text-[11px] font-bold tracking-wide text-blue-300 bg-navy/40 border border-border rounded px-3 py-1.5 hover:bg-navy transition-colors">
                  + ADD TEAM
                </button>
              </div>
              <div className="space-y-4">
                {teams.map((team, i) => (
                  <div key={i} className="bg-black/20 rounded-lg p-4 border border-border/50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-cond font-black text-[12px] text-blue-300 tracking-wide">TEAM {i + 1}</span>
                      {teams.length > 1 && (
                        <button onClick={() => removeTeam(i)}
                          className="font-cond text-[10px] text-red-400 hover:text-red-300">REMOVE</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Team Name *</label>
                        <input className={inputCls} value={team.name}
                          onChange={e => updateTeam(i, 'name', e.target.value)}
                          placeholder="e.g. Fleming Island Knights" />
                      </div>
                      <div>
                        <label className={labelCls}>Division *</label>
                        <select className={inputCls} value={team.division}
                          onChange={e => updateTeam(i, 'division', e.target.value)}>
                          {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Head Coach Name</label>
                        <input className={inputCls} value={team.coachName}
                          onChange={e => updateTeam(i, 'coachName', e.target.value)}
                          placeholder="Coach full name" />
                      </div>
                      <div>
                        <label className={labelCls}>Head Coach Email</label>
                        <input type="email" className={inputCls} value={team.coachEmail}
                          onChange={e => updateTeam(i, 'coachEmail', e.target.value)}
                          placeholder="coach@email.com" />
                      </div>
                      <div>
                        <label className={labelCls}>Expected Player Count</label>
                        <input type="number" className={inputCls} value={team.playerCount}
                          onChange={e => updateTeam(i, 'playerCount', e.target.value)}
                          placeholder="e.g. 18" min="1" max="30" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <ErrorBox msg={error} />}
            <div className="flex justify-between">
              <button onClick={() => setStep('account')}
                className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wider text-muted hover:text-white px-4 py-2.5 transition-colors">
                <ArrowLeft size={14} /> BACK
              </button>
              <button onClick={() => { if (validateProgram()) setStep('confirm') }}
                className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wider bg-navy hover:bg-navy-light text-white px-6 py-2.5 rounded-lg transition-colors">
                REVIEW <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-surface-card border border-border rounded-xl p-6">
              <div className="font-cond font-black text-[15px] tracking-wide mb-4">REVIEW YOUR REGISTRATION</div>

              <div className="space-y-4">
                <Section title="Account">
                  <Row label="Email" value={email} />
                </Section>

                <Section title="Program">
                  <Row label="Program" value={progName} />
                  {shortName && <Row label="Short Name" value={shortName} />}
                  {association && <Row label="Association" value={association} />}
                  {city && <Row label="Location" value={`${city}, ${state}`} />}
                  <Row label="Contact" value={contactName} />
                </Section>

                <Section title={`Teams (${teams.length})`}>
                  {teams.map((t, i) => (
                    <div key={i} className="flex justify-between text-[12px] mb-1">
                      <span className="font-cond font-bold text-white">{t.name}</span>
                      <span className="text-blue-300 font-cond">{t.division}</span>
                    </div>
                  ))}
                </Section>

                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3">
                  <div className="font-cond font-bold text-[11px] text-yellow-400 mb-1">WHAT HAPPENS NEXT</div>
                  <div className="font-cond text-[11px] text-muted leading-relaxed">
                    Your registration will be reviewed by the league administrator. Once approved, you'll receive access to manage your program's teams and rosters. This typically takes 1–2 business days.
                  </div>
                </div>
              </div>
            </div>

            {error && <ErrorBox msg={error} />}
            <div className="flex justify-between">
              <button onClick={() => setStep('program')}
                className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wider text-muted hover:text-white px-4 py-2.5 transition-colors">
                <ArrowLeft size={14} /> BACK
              </button>
              <button onClick={submit} disabled={saving}
                className="flex items-center gap-2 font-cond font-black text-[14px] tracking-wider bg-navy hover:bg-navy-light text-white px-8 py-3 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'SUBMITTING...' : 'SUBMIT REGISTRATION'}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-600/50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={36} className="text-green-400" />
            </div>
            <div className="font-cond font-black text-[24px] text-white mb-3 tracking-wide">
              REGISTRATION SUBMITTED!
            </div>
            <div className="font-cond text-[13px] text-muted mb-6 leading-relaxed max-w-md mx-auto">
              Your program <span className="text-white font-bold">{progName}</span> has been submitted for review.
              The league administrator will approve your account and you'll be able to log in and manage your teams.
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5 max-w-sm mx-auto text-left mb-6">
              <div className="font-cond font-black text-[12px] tracking-widest text-muted uppercase mb-3">YOUR SUBMISSION</div>
              <Row label="Program" value={progName} />
              <Row label="Contact" value={contactName} />
              <Row label="Email" value={email} />
              <Row label="Teams" value={`${teams.length} team${teams.length > 1 ? 's' : ''} pending`} />
            </div>
            <a href="/"
              className="font-cond font-black text-[13px] tracking-wider text-blue-300 hover:text-white transition-colors">
              ← Return to Login
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12px] mb-1.5">
      <span className="text-muted font-cond">{label}</span>
      <span className="text-white font-cond font-bold">{value}</span>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-[12px] text-red-300 font-cond font-bold mt-3">
      {msg}
    </div>
  )
}
